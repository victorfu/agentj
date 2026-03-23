import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

import websocketPlugin from '@fastify/websocket';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
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
  lineChannels,
  lineWebhookEvents,
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
  agentSessionId: string;
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
  managedWebhookEventId?: string;
  upstreamStatusCode?: number | null;
  timeoutHandle?: NodeJS.Timeout;
}

const agentsByTunnel = new Map<string, AgentConnection>();
const streams = new Map<string, StreamState>();
const streamsBySession = new Map<string, Set<string>>();
const activeStreamsByTunnel = new Map<string, number>();
const pendingOfflineTimersByTunnel = new Map<string, NodeJS.Timeout>();
let activeStreamsGlobal = 0;
let isProcessingLineWebhookEvents = false;

const REDACT_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key'
]);

const REQUEST_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 1000;
const WS_CLOSE_CODE_TUNNEL_BUSY = 4429;
const LINE_WEBHOOK_PATH = '/line/webhook';
const LINE_WEBHOOK_PROCESS_BATCH_SIZE = 20;

const LINE_WEBHOOK_MAX_RETRIES = 5;
const LINE_WEBHOOK_RETRY_BASE_MS = 1000;
const LINE_WEBHOOK_RETRY_MAX_MS = 30000;
const LINE_WEBHOOK_DISPATCH_LEASE_MS = env.AGENTJ_STREAM_TIMEOUT_MS + 5000;
const LINE_WEBHOOK_MAX_BODY_BYTES = env.AGENTJ_REQUEST_BODY_LIMIT_BYTES;

function runSafely(promise: Promise<unknown>, context: string): void {
  promise.catch((error: unknown) => {
    app.log.error({ context, error }, 'async task failed');
  });
}

function splitPathAndQuery(url: string): { path: string; query: string } {
  const idx = url.indexOf('?');
  if (idx === -1) {
    return { path: url, query: '' };
  }
  return {
    path: url.slice(0, idx) || '/',
    query: url.slice(idx + 1)
  };
}

function normalizeLineSignatureHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return (value[0] ?? '').trim() || null;
  }
  return null;
}

function createLineWebhookSignature(payload: Buffer, channelSecret: string): string {
  return createHmac('sha256', channelSecret).update(payload).digest('base64');
}

function verifyLineWebhookSignature(payload: Buffer, signature: string, channelSecret: string): boolean {
  const digest = createLineWebhookSignature(payload, channelSecret);
  const received = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(digest, 'utf8');
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(received, expected);
}

function calculateLineWebhookNextRetry(attempts: number): Date {
  const exponential = Math.min(LINE_WEBHOOK_RETRY_MAX_MS, LINE_WEBHOOK_RETRY_BASE_MS * 2 ** attempts);
  return new Date(Date.now() + exponential);
}

function deriveLineWebhookDedupId(payloadText: string): string {
  try {
    const parsed = JSON.parse(payloadText) as {
      events?: Array<{ webhookEventId?: unknown }>;
    };
    if (Array.isArray(parsed.events) && parsed.events.length === 1) {
      const id = parsed.events[0]?.webhookEventId;
      if (typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }
  } catch {
    // Fall through to payload hash dedup key.
  }

  const digest = createHash('sha256').update(payloadText).digest('hex');
  return `payload:${digest}`;
}

async function findLineChannelByTunnel(tunnelId: string) {
  return (
    (await db.query.lineChannels.findFirst({
      where: eq(lineChannels.tunnelId, tunnelId)
    })) ?? null
  );
}

async function enqueueLineWebhookEvents(
  lineChannelId: string,
  tunnelId: string,
  requestHeaders: Record<string, string | string[]>,
  payloadText: string
): Promise<number> {
  try {
    await db.insert(lineWebhookEvents).values({
      id: `lwe_${randomUUID()}`,
      lineChannelId,
      tunnelId,
      webhookEventId: deriveLineWebhookDedupId(payloadText),
      status: 'pending',
      attempts: 0,
      requestHeaders,
      payloadText
    });
    return 1;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      // Duplicate webhook event id. Ignore as idempotent insert.
      return 0;
    }

    throw error;
  }
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

interface BufferedHttpIngressOptions {
  tunnelId: string;
  host: string;
  method: string;
  path: string;
  query: string;
  headers: Record<string, string | string[]>;
  rawBody: Buffer;
  contentType: string | null;
  agent: AgentConnection;
  reply?: FastifyReply;
  managedWebhookEventId?: string;
}

async function startBufferedHttpIngress(options: BufferedHttpIngressOptions): Promise<string | null> {
  if (!reserveStreamCapacity(options.tunnelId)) {
    if (options.reply) {
      options.reply.code(503).send({
        error: {
          code: 'TUNNEL_BUSY',
          message: 'Tunnel is busy'
        }
      });
    }
    return null;
  }

  const streamId = `str_${randomUUID()}`;
  const requestId = `req_${randomUUID()}`;

  const state: StreamState = {
    streamId,
    tunnelId: options.tunnelId,
    agentSessionId: options.agent.sessionId,
    requestId,
    reply: options.reply,
    requestBytes: 0,
    responseBytes: 0,
    requestChunkIndex: 0,
    responseChunkIndex: 0,
    requestTruncated: false,
    responseTruncated: false,
    startedAtMs: Date.now(),
    protocol: 'http',
    managedWebhookEventId: options.managedWebhookEventId,
    upstreamStatusCode: null
  };

  streams.set(streamId, state);
  trackStreamBySession(state);
  armStreamTimeout(state);

  try {
    await db.insert(ingressRequests).values({
      id: requestId,
      tunnelId: options.tunnelId,
      streamId,
      method: options.method,
      host: options.host,
      path: options.path,
      query: options.query,
      requestHeaders: redactHeaders(options.headers),
      responseHeaders: {}
    });
  } catch (error) {
    await failStream(streamId, 502, 'INGRESS_PERSIST_FAILED', (error as Error).message);
    return null;
  }

  const startMessage: IngressRequestStartMessage = {
    type: 'ingress_request_start',
    streamId,
    protocol: 'http',
    method: options.method,
    path: options.path,
    query: options.query,
    headers: normalizeHeaders(options.headers)
  };

  try {
    await sendToAgent(options.agent, startMessage);
  } catch (error) {
    await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
    return null;
  }

  if (options.rawBody.length > 0) {
    const chunkMessage: IngressRequestChunkMessage = {
      type: 'ingress_request_chunk',
      streamId,
      chunkIndex: state.requestChunkIndex,
      isBinary: true,
      dataBase64: options.rawBody.toString('base64')
    };
    state.requestChunkIndex += 1;
    try {
      await sendToAgent(options.agent, chunkMessage);
    } catch (error) {
      await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
      return null;
    }

    await persistChunk(
      state,
      'request',
      chunkMessage.chunkIndex,
      options.rawBody,
      true,
      options.contentType
    );
  }

  const endMessage: IngressRequestEndMessage = {
    type: 'ingress_request_end',
    streamId
  };
  try {
    await sendToAgent(options.agent, endMessage);
  } catch (error) {
    await failStream(streamId, 502, 'AGENT_SEND_FAILED', (error as Error).message);
    return null;
  }

  return streamId;
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

function trackStreamBySession(state: StreamState): void {
  const set = streamsBySession.get(state.agentSessionId) ?? new Set<string>();
  set.add(state.streamId);
  streamsBySession.set(state.agentSessionId, set);
}

function untrackStreamBySession(state: StreamState): void {
  const set = streamsBySession.get(state.agentSessionId);
  if (!set) {
    return;
  }

  set.delete(state.streamId);
  if (set.size === 0) {
    streamsBySession.delete(state.agentSessionId);
  }
}

function reserveStreamCapacity(tunnelId: string): boolean {
  const tunnelActive = activeStreamsByTunnel.get(tunnelId) ?? 0;

  if (activeStreamsGlobal >= env.AGENTJ_MAX_ACTIVE_STREAMS_GLOBAL) {
    return false;
  }

  if (tunnelActive >= env.AGENTJ_MAX_ACTIVE_STREAMS_PER_TUNNEL) {
    return false;
  }

  activeStreamsGlobal += 1;
  activeStreamsByTunnel.set(tunnelId, tunnelActive + 1);
  return true;
}

function releaseStreamCapacity(tunnelId: string): void {
  if (activeStreamsGlobal > 0) {
    activeStreamsGlobal -= 1;
  }

  const tunnelActive = activeStreamsByTunnel.get(tunnelId) ?? 0;
  if (tunnelActive <= 1) {
    activeStreamsByTunnel.delete(tunnelId);
    return;
  }

  activeStreamsByTunnel.set(tunnelId, tunnelActive - 1);
}

function clearPendingOfflineTimer(tunnelId: string): void {
  const timer = pendingOfflineTimersByTunnel.get(tunnelId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  pendingOfflineTimersByTunnel.delete(tunnelId);
}

function scheduleTunnelOfflineAfterGrace(tunnelId: string): void {
  clearPendingOfflineTimer(tunnelId);

  const timer = setTimeout(() => {
    pendingOfflineTimersByTunnel.delete(tunnelId);
    if (agentsByTunnel.has(tunnelId)) {
      return;
    }

    runSafely(
      db
        .update(tunnels)
        .set({ status: 'offline', updatedAt: new Date() })
        .where(eq(tunnels.id, tunnelId)),
      `mark_tunnel_offline:${tunnelId}`
    );
  }, env.AGENTJ_AGENT_RECONNECT_GRACE_MS);
  timer.unref();

  pendingOfflineTimersByTunnel.set(tunnelId, timer);
}

function isTunnelReconnecting(tunnelId: string): boolean {
  return pendingOfflineTimersByTunnel.has(tunnelId) && !agentsByTunnel.has(tunnelId);
}

function failActiveStreamsForSession(sessionId: string, reason: string): void {
  const streamIds = [...(streamsBySession.get(sessionId) ?? [])];
  for (const streamId of streamIds) {
    runSafely(failStream(streamId, 502, 'TUNNEL_OFFLINE', reason), `fail_stream:${streamId}`);
  }
}

function resolveStreamForSession(
  connection: AgentConnection,
  streamId: string,
  messageType: string
): StreamState | null {
  const state = streams.get(streamId);
  if (!state) {
    return null;
  }

  if (state.agentSessionId !== connection.sessionId) {
    app.log.warn(
      {
        streamId,
        messageType,
        tunnelId: connection.tunnelId,
        sessionId: connection.sessionId,
        ownerSessionId: state.agentSessionId
      },
      'ignoring stream message from non-owner agent session'
    );
    return null;
  }

  return state;
}

function buildDisconnectReason(code: number, reason: Buffer): string {
  const reasonText = reason.toString('utf8').trim();
  if (!reasonText) {
    return `socket_closed:${code}`;
  }

  return `socket_closed:${code}:${reasonText.slice(0, 120)}`;
}

setInterval(() => {
  runSafely(cleanupOldRequestLogs(), 'cleanup_old_request_logs');
}, 24 * 60 * 60 * 1000).unref();

setInterval(() => {
  runSafely(processPendingLineWebhookEvents(), 'process_pending_line_webhook_events');
}, 2000).unref();

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

  const { path, query } = splitPathAndQuery(request.url);
  const normalizedHeaders = normalizeHeaders(request.headers);
  const lineChannel = path === LINE_WEBHOOK_PATH ? await findLineChannelByTunnel(tunnel.id) : null;
  let lineWebhookBody: Buffer | null = null;

  if (lineChannel) {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request.raw) {
      const chunkBuffer = Buffer.from(chunk as Buffer);
      totalBytes += chunkBuffer.byteLength;
      if (totalBytes > LINE_WEBHOOK_MAX_BODY_BYTES) {
        reply.code(413).send({
          error: {
            code: 'REQUEST_BODY_TOO_LARGE',
            message: `LINE webhook payload exceeds ${LINE_WEBHOOK_MAX_BODY_BYTES} bytes`
          }
        });
        return;
      }
      chunks.push(chunkBuffer);
    }
    lineWebhookBody = Buffer.concat(chunks);

    const signature = normalizeLineSignatureHeader(request.headers['x-line-signature']);
    if (!signature || !verifyLineWebhookSignature(lineWebhookBody, signature, lineChannel.channelSecret)) {
      reply.code(401).send({
        error: {
          code: 'LINE_SIGNATURE_INVALID',
          message: 'Invalid LINE webhook signature'
        }
      });
      return;
    }

    if (lineChannel.mode === 'managed') {
      try {
        const inserted = await enqueueLineWebhookEvents(
          lineChannel.id,
          tunnel.id,
          normalizedHeaders,
          lineWebhookBody.toString('utf8')
        );

        reply.code(200).send({
          ok: true,
          mode: 'managed',
          queuedEvents: inserted
        });
      } catch (error) {
        app.log.error({ error, tunnelId: tunnel.id }, 'failed to enqueue managed LINE webhook event');
        reply.code(500).send({
          error: {
            code: 'LINE_WEBHOOK_QUEUE_FAILED',
            message: 'Failed to queue LINE webhook event'
          }
        });
      }
      return;
    }
  }

  const agent = agentsByTunnel.get(tunnel.id);
  if (!agent) {
    if (isTunnelReconnecting(tunnel.id)) {
      reply.code(503).send({
        error: {
          code: 'TUNNEL_RECONNECTING',
          message: 'Tunnel agent is reconnecting'
        }
      });
      return;
    }

    reply.code(410).send({
      error: {
        code: 'TUNNEL_OFFLINE',
        message: 'Tunnel is offline'
      }
    });
    return;
  }

  if (lineChannel && lineWebhookBody) {
    const streamId = await startBufferedHttpIngress({
      tunnelId: tunnel.id,
      host: hostContext.parsedHost,
      method: request.method,
      path,
      query,
      headers: normalizedHeaders,
      rawBody: lineWebhookBody,
      contentType: request.headers['content-type']?.toString() ?? null,
      agent,
      reply
    });

    if (!streamId) {
      return;
    }

    await new Promise<void>((resolve) => {
      reply.raw.once('close', () => resolve());
      reply.raw.once('finish', () => resolve());
    });
    return;
  }

  if (!reserveStreamCapacity(tunnel.id)) {
    reply.code(503).send({
      error: {
        code: 'TUNNEL_BUSY',
        message: 'Tunnel is busy'
      }
    });
    return;
  }

  const streamId = `str_${randomUUID()}`;
  const requestId = `req_${randomUUID()}`;

  const state: StreamState = {
    streamId,
    tunnelId: tunnel.id,
    agentSessionId: agent.sessionId,
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
  trackStreamBySession(state);
  armStreamTimeout(state);

  try {
    await db.insert(ingressRequests).values({
      id: requestId,
      tunnelId: tunnel.id,
      streamId,
      method: request.method,
      host: hostContext.parsedHost,
      path,
      query,
      requestHeaders: redactHeaders(request.headers),
      responseHeaders: {}
    });
  } catch (error) {
    await failStream(streamId, 502, 'INGRESS_PERSIST_FAILED', (error as Error).message);
    return;
  }

  const startMessage: IngressRequestStartMessage = {
    type: 'ingress_request_start',
    streamId,
    protocol: 'http',
    method: request.method,
    path,
    query,
    headers: normalizedHeaders
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
  const markMissedHeartbeatAndMaybeClose = (reason: 'ping_send_failed' | 'pong_missing'): void => {
    if (!activeConnection) {
      return;
    }

    if (!markAgentPingAndShouldClose(heartbeatState)) {
      return;
    }

    app.log.warn(
      {
        tunnelId: activeConnection.tunnelId,
        sessionId,
        missedPongs: heartbeatState.missedPongs,
        reason
      },
      'agent heartbeat timeout'
    );
    socket.close(4411, 'Heartbeat timeout');
  };

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
          clearPendingOfflineTimer(payload.tunnelId);

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
          markMissedHeartbeatAndMaybeClose('ping_send_failed');
          return;
        } finally {
          pingSendInFlight = false;
        }

        markMissedHeartbeatAndMaybeClose('pong_missing');
      })(),
      `send_ping:${sessionId}`
    );
  }, env.AGENTJ_AGENT_PING_INTERVAL_MS);
  pingTimer.unref();

  socket.on('close', (code, reasonBuffer) => {
    clearTimeout(helloTimeout);
    clearInterval(pingTimer);

    if (activeConnection) {
      failActiveStreamsForSession(activeConnection.sessionId, 'Agent disconnected');

      const latest = agentsByTunnel.get(activeConnection.tunnelId);
      if (latest?.sessionId === activeConnection.sessionId) {
        agentsByTunnel.delete(activeConnection.tunnelId);
        scheduleTunnelOfflineAfterGrace(activeConnection.tunnelId);
      }
    }

    runSafely(
      db
        .update(tunnelSessions)
        .set({ disconnectReason: buildDisconnectReason(code, reasonBuffer) })
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
    socket.close(4410, isTunnelReconnecting(tunnel.id) ? 'Tunnel reconnecting' : 'Tunnel offline');
    return;
  }

  if (!reserveStreamCapacity(tunnel.id)) {
    socket.close(WS_CLOSE_CODE_TUNNEL_BUSY, 'Tunnel busy');
    return;
  }

  const streamId = `str_${randomUUID()}`;
  const requestId = `req_${randomUUID()}`;
  const wsSendQueue = createSocketSendQueue(socket);

  const state: StreamState = {
    streamId,
    tunnelId: tunnel.id,
    agentSessionId: agent.sessionId,
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
  trackStreamBySession(state);
  armStreamTimeout(state);

  const { path: wsPath, query: wsQuery } = splitPathAndQuery(request.url);

  try {
    await db.insert(ingressRequests).values({
      id: requestId,
      tunnelId: tunnel.id,
      streamId,
      method: request.method,
      host: hostContext.parsedHost,
      path: wsPath,
      query: wsQuery,
      requestHeaders: redactHeaders(request.headers),
      responseHeaders: {}
    });
  } catch (error) {
    await failStream(streamId, 502, 'INGRESS_PERSIST_FAILED', (error as Error).message);
    return;
  }

  const startMessage: IngressRequestStartMessage = {
    type: 'ingress_request_start',
    streamId,
    protocol: 'ws',
    method: request.method,
    path: wsPath,
    query: wsQuery,
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
      await onAgentResponseStart(connection, message);
      return;
    }
    case 'agent_response_chunk': {
      await onAgentResponseChunk(connection, message);
      return;
    }
    case 'agent_response_end': {
      await onAgentResponseEnd(connection, message);
      return;
    }
    case 'stream_error': {
      await onStreamError(connection, message);
      return;
    }
    default:
      return;
  }
}

async function onAgentResponseStart(
  connection: AgentConnection,
  message: AgentResponseStartMessage
): Promise<void> {
  const state = resolveStreamForSession(connection, message.streamId, message.type);
  if (!state) {
    return;
  }
  armStreamTimeout(state);

  if (state.protocol === 'http' && state.reply && !state.reply.raw.headersSent) {
    state.reply.raw.writeHead(message.statusCode, toOutgoingHttpHeaders(message.headers));
  }
  state.upstreamStatusCode = message.statusCode;

  await db
    .update(ingressRequests)
    .set({ statusCode: message.statusCode, responseHeaders: redactHeaders(message.headers) })
    .where(eq(ingressRequests.id, state.requestId));
}

async function onAgentResponseChunk(
  connection: AgentConnection,
  message: AgentResponseChunkMessage
): Promise<void> {
  const state = resolveStreamForSession(connection, message.streamId, message.type);
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

async function onAgentResponseEnd(
  connection: AgentConnection,
  message: AgentResponseEndMessage
): Promise<void> {
  const state = resolveStreamForSession(connection, message.streamId, message.type);
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

async function onStreamError(connection: AgentConnection, message: StreamErrorMessage): Promise<void> {
  const state = resolveStreamForSession(connection, message.streamId, message.type);
  if (!state) {
    return;
  }

  await failStream(state.streamId, 502, 'UPSTREAM_STREAM_ERROR', message.message);
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
    if (!state.reply.raw.headersSent) {
      state.reply.raw.statusCode = statusCode;
      state.reply.raw.end(JSON.stringify({
        error: {
          code: errorCode,
          message: errorMessage
        }
      }));
    } else {
      state.reply.raw.destroy();
    }
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
  const finalStatusCode = statusCode ?? state.upstreamStatusCode ?? null;

  try {
    await db
      .update(ingressRequests)
      .set({
        statusCode: finalStatusCode ?? undefined,
        latencyMs,
        endedAt
      })
      .where(eq(ingressRequests.id, state.requestId));
  } catch (error) {
    app.log.warn({ streamId, error }, 'failed to persist finalized stream state');
  }

  if (errorMessage) {
    app.log.warn({ streamId, errorMessage }, 'stream error');
  }

  if (state.managedWebhookEventId) {
    try {
      const delivered =
        errorMessage === null &&
        finalStatusCode !== null &&
        finalStatusCode >= 200 &&
        finalStatusCode < 300;

      if (delivered) {
        await markLineWebhookEventDelivered(state.managedWebhookEventId);
      } else {
        const reason =
          errorMessage ??
          (finalStatusCode === null
            ? 'missing upstream response status'
            : `upstream responded with status ${finalStatusCode}`);
        await markLineWebhookEventRetryById(state.managedWebhookEventId, reason);
      }
    } catch (error) {
      app.log.warn(
        {
          streamId,
          managedWebhookEventId: state.managedWebhookEventId,
          error
        },
        'failed to update managed LINE webhook event status'
      );
    }
  }

  untrackStreamBySession(state);
  releaseStreamCapacity(state.tunnelId);
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

async function markLineWebhookEventRetry(
  event: typeof lineWebhookEvents.$inferSelect,
  reason: string
): Promise<void> {
  const nextAttempts = event.attempts + 1;
  const reachedMax = nextAttempts >= LINE_WEBHOOK_MAX_RETRIES;
  await db
    .update(lineWebhookEvents)
    .set({
      status: reachedMax ? 'failed' : 'pending',
      attempts: nextAttempts,
      nextRetryAt: reachedMax ? null : calculateLineWebhookNextRetry(nextAttempts),
      lastError: reason
    })
    .where(eq(lineWebhookEvents.id, event.id));
}

async function markLineWebhookEventRetryById(eventId: string, reason: string): Promise<void> {
  const event = await db.query.lineWebhookEvents.findFirst({
    where: eq(lineWebhookEvents.id, eventId)
  });
  if (!event || event.status !== 'pending') {
    return;
  }

  await markLineWebhookEventRetry(event, reason);
}

async function claimLineWebhookEventForDispatch(eventId: string): Promise<boolean> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LINE_WEBHOOK_DISPATCH_LEASE_MS);

  const claimed = await db
    .update(lineWebhookEvents)
    .set({
      nextRetryAt: leaseUntil
    })
    .where(
      and(
        eq(lineWebhookEvents.id, eventId),
        eq(lineWebhookEvents.status, 'pending'),
        or(isNull(lineWebhookEvents.nextRetryAt), lte(lineWebhookEvents.nextRetryAt, now))
      )
    )
    .returning({ id: lineWebhookEvents.id });

  return claimed.length > 0;
}

async function markLineWebhookEventDelivered(eventId: string): Promise<void> {
  await db
    .update(lineWebhookEvents)
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      nextRetryAt: null,
      lastError: null
    })
    .where(eq(lineWebhookEvents.id, eventId));
}

async function processPendingLineWebhookEvents(): Promise<void> {
  if (isProcessingLineWebhookEvents) {
    return;
  }
  isProcessingLineWebhookEvents = true;

  try {
    const now = new Date();
    const pending = await db
      .select()
      .from(lineWebhookEvents)
      .where(
        and(
          eq(lineWebhookEvents.status, 'pending'),
          or(isNull(lineWebhookEvents.nextRetryAt), lte(lineWebhookEvents.nextRetryAt, now))
        )
      )
      .orderBy(asc(lineWebhookEvents.createdAt))
      .limit(LINE_WEBHOOK_PROCESS_BATCH_SIZE);

    for (const event of pending) {
      await processSingleLineWebhookEvent(event);
    }
  } finally {
    isProcessingLineWebhookEvents = false;
  }
}

async function processSingleLineWebhookEvent(event: typeof lineWebhookEvents.$inferSelect): Promise<void> {
  const claimed = await claimLineWebhookEventForDispatch(event.id);
  if (!claimed) {
    return;
  }

  const [channel, tunnel] = await Promise.all([
    db.query.lineChannels.findFirst({ where: eq(lineChannels.id, event.lineChannelId) }),
    db.query.tunnels.findFirst({ where: eq(tunnels.id, event.tunnelId) })
  ]);

  if (!channel || !tunnel) {
    await db
      .update(lineWebhookEvents)
      .set({
        status: 'failed',
        attempts: event.attempts + 1,
        lastError: 'line channel or tunnel not found'
      })
      .where(eq(lineWebhookEvents.id, event.id));
    return;
  }

  const agent = agentsByTunnel.get(event.tunnelId);
  if (!agent) {
    await markLineWebhookEventRetry(event, 'agent offline');
    return;
  }

  const streamId = await startBufferedHttpIngress({
    tunnelId: tunnel.id,
    host: `${tunnel.subdomain}.${env.AGENTJ_TUNNEL_BASE_DOMAIN}`,
    method: 'POST',
    path: channel.webhookPath,
    query: '',
    headers: event.requestHeaders,
    rawBody: Buffer.from(event.payloadText, 'utf8'),
    contentType: 'application/json',
    agent,
    managedWebhookEventId: event.id
  });

  if (!streamId) {
    await markLineWebhookEventRetry(event, 'failed to start managed webhook stream');
    return;
  }
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
  for (const timer of pendingOfflineTimersByTunnel.values()) {
    clearTimeout(timer);
  }
  pendingOfflineTimersByTunnel.clear();
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
