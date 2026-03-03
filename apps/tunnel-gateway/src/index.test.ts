import { describe, expect, it } from 'vitest';

import { toOutgoingHttpHeaders } from './lib/http-headers.js';
import {
  TUNNEL_NOT_FOUND_CLOSE_REASON,
  parseHostHeader,
  resolveTunnelSubdomain,
  unknownTunnelClosePayload
} from './lib/tunnel-routing.js';

describe('toOutgoingHttpHeaders', () => {
  it('preserves set-cookie as array values', () => {
    const headers = toOutgoingHttpHeaders({
      'set-cookie': ['sid=1; Path=/', 'lang=zh-TW; Path=/'],
      'content-type': 'application/json'
    });

    expect(headers['set-cookie']).toEqual(['sid=1; Path=/', 'lang=zh-TW; Path=/']);
    expect(headers['content-type']).toBe('application/json');
  });
});

describe('tunnel host resolution', () => {
  it('parses host header with port and resolves subdomain', () => {
    const parsedHost = parseHostHeader('abc123.tunnel.localhost:4000');
    expect(parsedHost).toBe('abc123.tunnel.localhost');
    expect(resolveTunnelSubdomain(parsedHost, 'tunnel.localhost')).toBe('abc123');
  });

  it('returns null for invalid host/domain', () => {
    const parsedHost = parseHostHeader('localhost:4000');
    expect(resolveTunnelSubdomain(parsedHost, 'tunnel.localhost')).toBeNull();
  });
});

describe('agent hello tunnel guard', () => {
  it('returns close payload when tunnel is unknown', () => {
    expect(unknownTunnelClosePayload(false)).toEqual({
      code: 4404,
      reason: TUNNEL_NOT_FOUND_CLOSE_REASON
    });
  });

  it('returns null when tunnel exists', () => {
    expect(unknownTunnelClosePayload(true)).toBeNull();
  });
});
