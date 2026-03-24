import { describe, expect, it } from 'vitest';

import {
  buildForwardRequestHeaders,
  computeReconnectDelayMs,
  isRetryableGatewayCloseCode,
  mapGatewayCloseAction
} from './gateway-agent.js';

describe('mapGatewayCloseAction', () => {
  it('maps 4404 to mismatch diagnostic', () => {
    const action = mapGatewayCloseAction(4404);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('DATABASE_URL');
    expect(action?.message).toContain('AGENTJ_TUNNEL_BASE_DOMAIN');
    expect(action?.message).toContain('AGENTJ_CONNECT_TOKEN_SECRET');
    expect(action?.message).toContain('AGENTJ_GATEWAY_WS_PUBLIC_URL');
  });

  it('maps 4410 to tunnel-deleted diagnostic', () => {
    const action = mapGatewayCloseAction(4410);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('Tunnel was deleted');
  });

  it('maps 4408 to hello timeout diagnostic', () => {
    const action = mapGatewayCloseAction(4408);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('hello timeout');
  });

  it('maps 4411 to heartbeat timeout diagnostic', () => {
    const action = mapGatewayCloseAction(4411);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('heartbeat timeout');
  });

  it('returns null for unknown close code', () => {
    expect(mapGatewayCloseAction(1000)).toBeNull();
    expect(mapGatewayCloseAction(4999)).toBeNull();
  });

  it('maps 4401 to auth diagnostic', () => {
    const action = mapGatewayCloseAction(4401);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('invalid or expired connect token');
  });

  it('maps 4400 to malformed-message diagnostic', () => {
    const action = mapGatewayCloseAction(4400);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('malformed websocket message');
  });
});

describe('retry policy', () => {
  it('marks known fatal close codes as non-retryable', () => {
    expect(isRetryableGatewayCloseCode(4001)).toBe(false);
    expect(isRetryableGatewayCloseCode(4400)).toBe(false);
    expect(isRetryableGatewayCloseCode(4401)).toBe(false);
    expect(isRetryableGatewayCloseCode(4404)).toBe(false);
    expect(isRetryableGatewayCloseCode(4410)).toBe(false);
    expect(isRetryableGatewayCloseCode(1000)).toBe(false);
  });

  it('marks transient close codes as retryable', () => {
    expect(isRetryableGatewayCloseCode(4408)).toBe(true);
    expect(isRetryableGatewayCloseCode(4411)).toBe(true);
    expect(isRetryableGatewayCloseCode(4429)).toBe(true);
    expect(isRetryableGatewayCloseCode(1011)).toBe(true);
  });
});

describe('reconnect backoff', () => {
  it('uses exponential delay with jitter and max cap', () => {
    expect(computeReconnectDelayMs(1, 0.5)).toBe(1000);
    expect(computeReconnectDelayMs(2, 0.5)).toBe(2000);
    expect(computeReconnectDelayMs(3, 0.5)).toBe(4000);
    expect(computeReconnectDelayMs(99, 0.5)).toBe(15000);
  });

  it('applies bounded jitter', () => {
    expect(computeReconnectDelayMs(1, 0)).toBe(800);
    expect(computeReconnectDelayMs(1, 1)).toBe(1200);
    expect(computeReconnectDelayMs(5, 0)).toBe(12000);
    expect(computeReconnectDelayMs(5, 1)).toBe(15000);
  });
});

describe('buildForwardRequestHeaders', () => {
  it('removes host and adds forwarded host/port when missing', () => {
    const headers = buildForwardRequestHeaders({
      host: 'abc123.tunnel.localhost:4000',
      accept: 'text/html'
    });

    expect(headers.host).toBeUndefined();
    expect(headers['x-forwarded-host']).toBe('abc123.tunnel.localhost:4000');
    expect(headers['x-forwarded-port']).toBe('4000');
  });

  it('overwrites existing x-forwarded headers with parsed host values', () => {
    const headers = buildForwardRequestHeaders({
      host: 'abc123.tunnel.localhost:4000',
      'x-forwarded-host': 'proxy.example.com',
      'x-forwarded-port': '443'
    });

    expect(headers['x-forwarded-host']).toBe('abc123.tunnel.localhost:4000');
    expect(headers['x-forwarded-port']).toBe('4000');
  });

  it('supports ipv6 host header with port', () => {
    const headers = buildForwardRequestHeaders({
      host: '[::1]:8080'
    });

    expect(headers['x-forwarded-port']).toBe('8080');
  });
});
