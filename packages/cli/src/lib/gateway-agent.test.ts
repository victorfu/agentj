import { describe, expect, it } from 'vitest';

import { mapGatewayCloseAction } from './gateway-agent.js';

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

  it('returns null for unknown close code', () => {
    expect(mapGatewayCloseAction(1000)).toBeNull();
    expect(mapGatewayCloseAction(4999)).toBeNull();
  });
});
