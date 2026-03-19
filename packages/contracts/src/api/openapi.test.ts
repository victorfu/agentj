import { describe, expect, it } from 'vitest';

import openapi from './openapi.json' with { type: 'json' };

describe('openapi contract', () => {
  it('contains required control plane endpoints', () => {
    expect(openapi.paths).toHaveProperty('/api/v1/auth/register');
    expect(openapi.paths).toHaveProperty('/api/v1/auth/login');
    expect(openapi.paths).toHaveProperty('/api/v1/auth/session');
    expect(openapi.paths).toHaveProperty('/api/v1/me');
    expect(openapi.paths).toHaveProperty('/api/v1/pats');
    expect(openapi.paths).toHaveProperty('/api/v1/pats/{patId}');
    expect(openapi.paths).toHaveProperty('/api/v1/pats/{patId}/tunnels');
    expect(openapi.paths).toHaveProperty('/api/v1/tunnels');
    expect(openapi.paths).toHaveProperty('/api/v1/tunnels/{tunnelId}/connect-token');
    expect(openapi.paths).toHaveProperty('/api/v1/line/channels');
    expect(openapi.paths).toHaveProperty('/api/v1/line/channels/{channelId}/webhook/sync');
  });
});
