import { describe, expect, it } from 'vitest';

import { buildForwardRequestHeaders, mapGatewayCloseAction } from './gateway-agent.js';

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

  it('maps 4410 to offline diagnostic', () => {
    const action = mapGatewayCloseAction(4410);
    expect(action).toBeTruthy();
    expect(action?.shouldExitNonZero).toBe(true);
    expect(action?.message).toContain('Tunnel offline');
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
