import type WebSocket from 'ws';

const DEFAULT_POLL_INTERVAL_MS = 10;
const WS_READY_STATE_OPEN = 1;

export type WebSocketSendData = string | Buffer | ArrayBuffer | Buffer[];
export interface WebSocketSendOptions {
  binary?: boolean;
  compress?: boolean;
  fin?: boolean;
  mask?: boolean;
}

export interface WebSocketBackpressureOptions {
  highWatermarkBytes: number;
  timeoutMs: number;
  pollIntervalMs?: number;
}

export function waitForWebSocketDrain(
  socket: Pick<WebSocket, 'bufferedAmount' | 'readyState'>,
  options: WebSocketBackpressureOptions
): Promise<void> {
  return waitForDrain(socket, options);
}

export class WebSocketSendQueue {
  private tail: Promise<void> = Promise.resolve();

  public constructor(
    private readonly socket: WebSocket,
    private readonly options: WebSocketBackpressureOptions
  ) {}

  public send(data: WebSocketSendData, sendOptions?: WebSocketSendOptions): Promise<void> {
    const next = this.tail
      .catch(() => undefined)
      .then(() => sendOverWebSocket(this.socket, data, this.options, sendOptions));

    this.tail = next;
    return next;
  }
}

async function waitForDrain(
  socket: Pick<WebSocket, 'bufferedAmount' | 'readyState'>,
  options: WebSocketBackpressureOptions
): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAtMs = Date.now();

  while (socket.bufferedAmount > options.highWatermarkBytes) {
    if (socket.readyState !== WS_READY_STATE_OPEN) {
      throw new Error('WebSocket is not open');
    }

    if (Date.now() - startedAtMs > options.timeoutMs) {
      throw new Error(`WebSocket send backpressure timeout after ${options.timeoutMs}ms`);
    }

    await sleep(pollIntervalMs);
  }

  if (socket.readyState !== WS_READY_STATE_OPEN) {
    throw new Error('WebSocket is not open');
  }
}

async function sendOverWebSocket(
  socket: WebSocket,
  data: WebSocketSendData,
  options: WebSocketBackpressureOptions,
  sendOptions?: WebSocketSendOptions
): Promise<void> {
  await waitForDrain(socket, options);

  await new Promise<void>((resolve, reject) => {
    const done = (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    if (sendOptions) {
      socket.send(data, sendOptions, done);
      return;
    }

    socket.send(data, done);
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}
