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
} from '@agentj/contracts';
import { parseGatewayMessage, serializeGatewayMessage } from '@agentj/contracts';
import WebSocket from 'ws';
import type { RawData } from 'ws';

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
  chunkIndex: number;
}

export interface GatewayCloseAction {
  shouldExitNonZero: boolean;
  message: string;
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

  if (code === 4410) {
    return {
      shouldExitNonZero: true,
      message: 'Tunnel offline or superseded (4410). The tunnel agent is not active for this tunnel.'
    };
  }

  return null;
}

export async function runAgent(options: AgentOptions): Promise<void> {
  const pendingHttp = new Map<string, PendingHttpStream>();
  const pendingWs = new Map<string, PendingWsStream>();
  const agentInstanceId = `agent_${crypto.randomUUID()}`;

  const ws = new WebSocket(options.gatewayWebsocketUrl, {
    headers: {
      authorization: `Bearer ${options.connectToken}`
    }
  });

  await onceOpen(ws);

  ws.send(
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

  ws.on('close', (code) => {
    for (const stream of pendingHttp.values()) {
      stream.request.destroy();
    }
    pendingHttp.clear();

    for (const stream of pendingWs.values()) {
      stream.socket.close();
    }
    pendingWs.clear();

    const closeAction = mapGatewayCloseAction(code);
    if (closeAction) {
      console.error(closeAction.message);
      if (closeAction.shouldExitNonZero) {
        process.exitCode = 1;
      }
    }
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
        ws.send(serializeGatewayMessage(pong));
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
            ws.send(serializeGatewayMessage(streamError));
          }
        } else {
          startHttpExchange(ws, message, options.targetHost, options.targetPort, pendingHttp);
        }
        return;
      }
      case 'ingress_request_chunk': {
        const wsStream = pendingWs.get(message.streamId);
        if (wsStream) {
          if (message.isBinary && message.dataBase64) {
            wsStream.socket.send(Buffer.from(message.dataBase64, 'base64'));
          } else {
            wsStream.socket.send(message.dataText ?? '');
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
      headers: flattenHeaders(message.headers)
    });

    await onceOpen(localSocket);

    const responseStart: AgentResponseStartMessage = {
      type: 'agent_response_start',
      streamId: message.streamId,
      statusCode: 101,
      headers: {}
    };
    ws.send(serializeGatewayMessage(responseStart));

    pendingWs.set(message.streamId, { socket: localSocket, chunkIndex: 0 });

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

      ws.send(serializeGatewayMessage(responseChunk));
    });

    localSocket.on('close', () => {
      const end: AgentResponseEndMessage = {
        type: 'agent_response_end',
        streamId: message.streamId
      };
      ws.send(serializeGatewayMessage(end));
      pendingWs.delete(message.streamId);
    });

    localSocket.on('error', (error) => {
      const streamError: StreamErrorMessage = {
        type: 'stream_error',
        streamId: message.streamId,
        message: error.message
      };
      ws.send(serializeGatewayMessage(streamError));
      pendingWs.delete(message.streamId);
    });
  }

  await new Promise<void>((resolve, reject) => {
    ws.once('close', () => resolve());
    ws.once('error', (error) => reject(error));
  });
}

function startHttpExchange(
  gatewaySocket: WebSocket,
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

  const requestHeaders = flattenHeaders(start.headers);
  delete requestHeaders.host;

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
      gatewaySocket.send(serializeGatewayMessage(startMessage));

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
        gatewaySocket.send(serializeGatewayMessage(chunkMessage));
      });

      res.on('end', () => {
        const durationMs = Date.now() - startedAtMs;
        console.log(`<-- ${statusCode} ${requestLine} (${durationMs}ms)`);
        const endMessage: AgentResponseEndMessage = {
          type: 'agent_response_end',
          streamId: start.streamId
        };
        gatewaySocket.send(serializeGatewayMessage(endMessage));
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
    gatewaySocket.send(serializeGatewayMessage(streamError));
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
