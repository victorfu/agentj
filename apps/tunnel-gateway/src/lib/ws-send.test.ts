import { describe, expect, it } from 'vitest';

import {
  hasBackpressureTimedOut,
  shouldThrottleWebSocketSend,
  waitForWebSocketDrain
} from './ws-send.js';

describe('ws send backpressure helpers', () => {
  it('detects when send should be throttled', () => {
    expect(shouldThrottleWebSocketSend(1025, 1024)).toBe(true);
    expect(shouldThrottleWebSocketSend(1024, 1024)).toBe(false);
  });

  it('detects timeout correctly', () => {
    expect(hasBackpressureTimedOut(1000, 100, 1200)).toBe(true);
    expect(hasBackpressureTimedOut(1000, 100, 1050)).toBe(false);
  });

  it('waits until buffered amount drops below watermark', async () => {
    const socket = {
      bufferedAmount: 2048,
      readyState: 1 as const
    };

    setTimeout(() => {
      socket.bufferedAmount = 0;
    }, 10);

    await expect(
      waitForWebSocketDrain(socket, {
        highWatermarkBytes: 1024,
        timeoutMs: 100,
        pollIntervalMs: 2
      })
    ).resolves.toBeUndefined();
  });

  it('throws when backpressure wait exceeds timeout', async () => {
    const socket = {
      bufferedAmount: 4096,
      readyState: 1 as const
    };

    await expect(
      waitForWebSocketDrain(socket, {
        highWatermarkBytes: 1024,
        timeoutMs: 10,
        pollIntervalMs: 2
      })
    ).rejects.toThrow('WebSocket send backpressure timeout');
  });
});
