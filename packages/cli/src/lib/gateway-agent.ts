import { request as httpRequest, type ClientRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

import type {
  AgentReadyMessage,
  AgentResponseChunkMessage,
  AgentResponseEndMessage,
  AgentResponseStartMessage,
  GatewayMessage,
  IngressRequestStartMessage,
  PingMessage,
  PongMessage,
  StreamErrorMessage
} from '@agentj/contracts/gateway';
import { parseGatewayMessage, serializeGatewayMessage } from '@agentj/contracts/gateway';
import WebSocket from 'ws';
import type { RawData } from 'ws';

import { WebSocketSendQueue, type WebSocketBackpressureOptions } from './ws-send.js';

interface AgentOptions {
  connectToken: string;
  tunnelId: string;
  gatewayWebsocketUrl: string;
  targetHost: string;
  targetPort: number;
}

interface PendingHttpStream {
  request: ClientRequest;
  ended: boolean;
}

interface PendingWsStream {
  socket: WebSocket;
  sendQueue: WebSocketSendQueue;
  chunkIndex: number;
}

const DEFAULT_WS_SEND_HIGH_WATERMARK_BYTES = 1048576;
const DEFAULT_WS_SEND_TIMEOUT_MS = 60000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const RECONNECT_JITTER_RATIO = 0.2;
const NON_RETRYABLE_CLOSE_CODES = new Set([4001, 4400, 4401, 4404, 4410]);

export interface GatewayCloseAction {
  shouldExitNonZero: boolean;
  message: string;
}

export interface AgentRunResult {
  closeCode: number | null;
  closeReason: string;
  retryable: boolean;
  connectedDurationMs: number;
}

export function mapGatewayCloseAction(code: number): GatewayCloseAction | null {
  if (code === 4404) {
    return {
      shouldExitNonZero: true,
      message:
        'Gateway rejected tunnel registration (4404): tunnel ID was not found in gateway DB.\n' +
        'Check that web and gateway share the same environment values:\n' +
        '- DATABASE_URL\n' +
        '- AGENTJ_TUNNEL_BASE_DOMAIN\n' +
        '- AGENTJ_CONNECT_TOKEN_SECRET\n' +
        '- AGENTJ_GATEWAY_WS_PUBLIC_URL'
    };
  }

  if (code === 4401) {
    return {
      shouldExitNonZero: true,
      message: 'Gateway rejected connection (4401): invalid or expired connect token.'
    };
  }

  if (code === 4400) {
    return {
      shouldExitNonZero: true,
      message: 'Gateway closed connection (4400): malformed websocket message.'
    };
  }

  if (code === 4410) {
    return {
      shouldExitNonZero: true,
      message: 'Tunnel was deleted (4410). It may have been replaced by another session (e.g. a new `line init`).'
    };
  }

  if (code === 4408) {
    return {
      shouldExitNonZero: true,
      message: 'Gateway closed connection (4408): agent hello timeout before registration completed.'
    };
  }

  if (code === 4411) {
    return {
      shouldExitNonZero: true,
      message: 'Gateway closed connection (4411): heartbeat timeout due to missed pongs.'
    };
  }

  return null;
}

export function isRetryableGatewayCloseCode(code: number): boolean {
  if (NON_RETRYABLE_CLOSE_CODES.has(code)) {
    return false;
  }

  if (code === 1000) {
    return false;
  }

  return true;
}

export function computeReconnectDelayMs(attempt: number, randomValue: number = Math.random()): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exponentialDelay = Math.min(
    RECONNECT_MAX_DELAY_MS,
    RECONNECT_BASE_DELAY_MS * 2 ** (safeAttempt - 1)
  );

  const normalizedRandom = Math.min(1, Math.max(0, randomValue));
  const jitterSpan = exponentialDelay * RECONNECT_JITTER_RATIO;
  const jittered = exponentialDelay + (normalizedRandom * 2 - 1) * jitterSpan;

  return Math.max(0, Math.min(RECONNECT_MAX_DELAY_MS, Math.round(jittered)));
}

function resolveWsBackpressureOptions(env: NodeJS.ProcessEnv = process.env): WebSocketBackpressureOptions {
  return {
    highWatermarkBytes: readPositiveInt(
      env.AGENTJ_WS_SEND_HIGH_WATERMARK_BYTES,
      DEFAULT_WS_SEND_HIGH_WATERMARK_BYTES
    ),
    timeoutMs: readPositiveInt(env.AGENTJ_STREAM_TIMEOUT_MS, DEFAULT_WS_SEND_TIMEOUT_MS)
  };
}

function readPositiveInt(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}

export async function runAgent(options: AgentOptions): Promise<AgentRunResult> {
  const pendingHttp = new Map<string, PendingHttpStream>();
  const pendingWs = new Map<string, PendingWsStream>();
  const agentInstanceId = `agent_${crypto.randomUUID()}`;
  const wsBackpressureOptions = resolveWsBackpressureOptions(process.env);

  const ws = new WebSocket(options.gatewayWebsocketUrl, {
    headers: {
      authorization: `Bearer ${options.connectToken}`
    }
  });
  const gatewaySendQueue = new WebSocketSendQueue(ws, wsBackpressureOptions);

  await onceOpen(ws);
  const connectedAtMs = Date.now();

  await gatewaySendQueue.send(
    serializeGatewayMessage({
      type: 'agent_hello',
      tunnelId: options.tunnelId,
      agentInstanceId
    })
  );

  ws.on('message', (raw) => {
    let incoming: GatewayMessage;
    try {
      incoming = parseGatewayMessage(rawDataToBuffer(raw).toString('utf8'));
    } catch {
      ws.close(4400, 'Malformed websocket message');
      return;
    }

    handleMessage(incoming).catch((error: unknown) => {
      console.error('agent message handler failed', error);
      ws.close(1011, 'Agent message handler failed');
    });
  });

  let cleanedUp = false;
  const cleanupStreams = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;

    for (const stream of pendingHttp.values()) {
      stream.request.destroy();
    }
    pendingHttp.clear();

    for (const stream of pendingWs.values()) {
      stream.socket.close();
    }
    pendingWs.clear();
  };

  ws.on('close', () => {
    cleanupStreams();
  });

  ws.on('error', () => {
    cleanupStreams();
  });

  async function handleMessage(message: GatewayMessage): Promise<void> {
    switch (message.type) {
      case 'agent_ready': {
        const ready = message as AgentReadyMessage;
        console.log(`Agent ready for tunnel ${ready.tunnelId}`);
        return;
      }
      case 'ping': {
        const ping = message as PingMessage;
        const pong: PongMessage = { type: 'pong', ts: ping.ts };
        await gatewaySendQueue.send(serializeGatewayMessage(pong));
        return;
      }
      case 'ingress_request_start': {
        if (message.protocol === 'ws') {
          try {
            await handleWsStart(message);
          } catch (error) {
            const streamError: StreamErrorMessage = {
              type: 'stream_error',
              streamId: message.streamId,
              message: (error as Error).message
            };
            await gatewaySendQueue.send(serializeGatewayMessage(streamError));
          }
        } else {
          startHttpExchange(
            ws,
            gatewaySendQueue,
            message,
            options.targetHost,
            options.targetPort,
            pendingHttp
          );
        }
        return;
      }
      case 'ingress_request_chunk': {
        const wsStream = pendingWs.get(message.streamId);
        if (wsStream) {
          if (message.isBinary && message.dataBase64) {
            await wsStream.sendQueue.send(Buffer.from(message.dataBase64, 'base64'), { binary: true });
          } else {
            await wsStream.sendQueue.send(message.dataText ?? '');
          }
          return;
        }

        const httpStream = pendingHttp.get(message.streamId);
        if (httpStream && !httpStream.ended) {
          if (message.isBinary) {
            httpStream.request.write(Buffer.from(message.dataBase64 ?? '', 'base64'));
          } else {
            httpStream.request.write(message.dataText ?? '', 'utf8');
          }
        }
        return;
      }
      case 'ingress_request_end': {
        const wsStream = pendingWs.get(message.streamId);
        if (wsStream) {
          wsStream.socket.close();
          pendingWs.delete(message.streamId);
          return;
        }

        const httpStream = pendingHttp.get(message.streamId);
        if (httpStream && !httpStream.ended) {
          httpStream.ended = true;
          httpStream.request.end();
        }
        return;
      }
      default:
        return;
    }
  }

  async function handleWsStart(message: IngressRequestStartMessage): Promise<void> {
    const protocol = process.env.AGENTJ_LOCAL_WS_SCHEME ?? 'ws';
    const localUrl = `${protocol}://${options.targetHost}:${options.targetPort}${message.path}${
      message.query ? `?${message.query}` : ''
    }`;

    const localSocket = new WebSocket(localUrl, {
      headers: buildForwardRequestHeaders(message.headers)
    });
    const localSendQueue = new WebSocketSendQueue(localSocket, wsBackpressureOptions);

    await onceOpen(localSocket);

    const responseStart: AgentResponseStartMessage = {
      type: 'agent_response_start',
      streamId: message.streamId,
      statusCode: 101,
      headers: {}
    };
    await gatewaySendQueue.send(serializeGatewayMessage(responseStart));

    pendingWs.set(message.streamId, { socket: localSocket, sendQueue: localSendQueue, chunkIndex: 0 });

    localSocket.on('message', (payload, isBinary) => {
      const stream = pendingWs.get(message.streamId);
      if (!stream) {
        return;
      }
      const payloadBuffer = rawDataToBuffer(payload);

      const responseChunk: AgentResponseChunkMessage = {
        type: 'agent_response_chunk',
        streamId: message.streamId,
        chunkIndex: stream.chunkIndex,
        isBinary
      };

      stream.chunkIndex += 1;

      if (isBinary) {
        responseChunk.dataBase64 = payloadBuffer.toString('base64');
      } else {
        responseChunk.dataText = payloadBuffer.toString('utf8');
      }

      void gatewaySendQueue.send(serializeGatewayMessage(responseChunk)).catch((error: unknown) => {
        console.error('failed to send websocket response chunk to gateway', error);
        ws.close(1011, 'Failed to send websocket response chunk');
      });
    });

    localSocket.on('close', () => {
      const end: AgentResponseEndMessage = {
        type: 'agent_response_end',
        streamId: message.streamId
      };
      void gatewaySendQueue.send(serializeGatewayMessage(end)).catch((error: unknown) => {
        console.error('failed to send websocket response end to gateway', error);
        ws.close(1011, 'Failed to send websocket response end');
      });
      pendingWs.delete(message.streamId);
    });

    localSocket.on('error', (error) => {
      const streamError: StreamErrorMessage = {
        type: 'stream_error',
        streamId: message.streamId,
        message: error.message
      };
      void gatewaySendQueue.send(serializeGatewayMessage(streamError)).catch((sendError: unknown) => {
        console.error('failed to send websocket stream error to gateway', sendError);
        ws.close(1011, 'Failed to send websocket stream error');
      });
      pendingWs.delete(message.streamId);
    });
  }

  return await new Promise<AgentRunResult>((resolve) => {
    let settled = false;

    const done = (result: AgentRunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    ws.once('close', (code, reasonBuffer) => {
      const reasonText = reasonBuffer.toString('utf8');
      done({
        closeCode: code,
        closeReason: reasonText,
        retryable: isRetryableGatewayCloseCode(code),
        connectedDurationMs: Date.now() - connectedAtMs
      });
    });

    ws.once('error', (error) => {
      done({
        closeCode: null,
        closeReason: error.message,
        retryable: true,
        connectedDurationMs: Date.now() - connectedAtMs
      });
    });
  });
}

function startHttpExchange(
  gatewaySocket: WebSocket,
  gatewaySendQueue: WebSocketSendQueue,
  start: IngressRequestStartMessage,
  targetHost: string,
  targetPort: number,
  pendingHttp: Map<string, PendingHttpStream>
): void {
  const requestPath = start.query ? `${start.path}?${start.query}` : start.path;
  const requestLine = `${start.method} ${requestPath}`;
  const startedAtMs = Date.now();
  console.log(`--> ${requestLine}`);

  const existing = pendingHttp.get(start.streamId);
  if (existing) {
    existing.request.destroy();
    pendingHttp.delete(start.streamId);
  }

  const localProtocol = process.env.AGENTJ_LOCAL_HTTP_SCHEME ?? 'http';
  const localUrl = new URL(`${localProtocol}://${targetHost}:${targetPort}${start.path}`);
  localUrl.search = start.query;

  const requestHeaders = buildForwardRequestHeaders(start.headers);

  const requestFn = localUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  const req = requestFn(
    localUrl,
    {
      method: start.method,
      headers: requestHeaders
    },
    (res) => {
      const statusCode = res.statusCode ?? 502;
      const startMessage: AgentResponseStartMessage = {
        type: 'agent_response_start',
        streamId: start.streamId,
        statusCode,
        headers: toHeaderRecord(res.headers)
      };
      void gatewaySendQueue.send(serializeGatewayMessage(startMessage)).catch((error: unknown) => {
        console.error('failed to send http response start to gateway', error);
        gatewaySocket.close(1011, 'Failed to send http response start');
      });

      let chunkIndex = 0;

      res.on('data', (chunk: Buffer) => {
        const chunkMessage: AgentResponseChunkMessage = {
          type: 'agent_response_chunk',
          streamId: start.streamId,
          chunkIndex,
          isBinary: true,
          dataBase64: chunk.toString('base64')
        };
        chunkIndex += 1;
        void gatewaySendQueue.send(serializeGatewayMessage(chunkMessage)).catch((error: unknown) => {
          console.error('failed to send http response chunk to gateway', error);
          gatewaySocket.close(1011, 'Failed to send http response chunk');
        });
      });

      res.on('end', () => {
        const durationMs = Date.now() - startedAtMs;
        console.log(`<-- ${statusCode} ${requestLine} (${durationMs}ms)`);
        const endMessage: AgentResponseEndMessage = {
          type: 'agent_response_end',
          streamId: start.streamId
        };
        void gatewaySendQueue.send(serializeGatewayMessage(endMessage)).catch((error: unknown) => {
          console.error('failed to send http response end to gateway', error);
          gatewaySocket.close(1011, 'Failed to send http response end');
        });
        pendingHttp.delete(start.streamId);
      });
    }
  );

  req.on('error', (error) => {
    const durationMs = Date.now() - startedAtMs;
    console.log(`<-- ERR ${requestLine} (${durationMs}ms): ${error.message}`);
    const streamError: StreamErrorMessage = {
      type: 'stream_error',
      streamId: start.streamId,
      message: error.message
    };
    void gatewaySendQueue.send(serializeGatewayMessage(streamError)).catch((sendError: unknown) => {
      console.error('failed to send http stream error to gateway', sendError);
      gatewaySocket.close(1011, 'Failed to send http stream error');
    });
    pendingHttp.delete(start.streamId);
  });

  pendingHttp.set(start.streamId, {
    request: req,
    ended: false
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

function flattenHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const entries = Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]);
  return Object.fromEntries(entries);
}

export function buildForwardRequestHeaders(
  headers: Record<string, string | string[]>
): Record<string, string> {
  const forwarded = flattenHeaders(headers);
  const host = forwarded.host?.trim();

  delete forwarded.host;
  delete forwarded['x-forwarded-host'];
  delete forwarded['x-forwarded-port'];

  if (host) {
    forwarded['x-forwarded-host'] = host;

    const port = parsePortFromHostHeader(host);
    if (port) {
      forwarded['x-forwarded-port'] = port;
    }
  }

  return forwarded;
}

function parsePortFromHostHeader(hostHeader: string): string | null {
  if (!hostHeader) {
    return null;
  }

  if (hostHeader.startsWith('[')) {
    const closingBracket = hostHeader.indexOf(']');
    if (closingBracket === -1) {
      return null;
    }

    const rest = hostHeader.slice(closingBracket + 1);
    if (!rest.startsWith(':')) {
      return null;
    }

    const port = rest.slice(1);
    return /^\d+$/.test(port) ? port : null;
  }

  const segments = hostHeader.split(':');
  if (segments.length !== 2) {
    return null;
  }

  const port = segments[1] ?? '';
  return /^\d+$/.test(port) ? port : null;
}

function toHeaderRecord(headers: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

function onceOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', (error) => reject(error));
  });
}
