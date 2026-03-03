import { describe, expect, it } from 'vitest';

import { createConnectToken, verifyConnectToken } from './connect-token.js';

describe('connect token', () => {
  it('round trips payload', () => {
    const token = createConnectToken(
      {
        userId: 'u1',
        projectId: 'p1',
        tunnelId: 't1',
        exp: Math.floor(Date.now() / 1000) + 60
      },
      'very-secret-key'
    );

    const payload = verifyConnectToken(token, 'very-secret-key');
    expect(payload.tunnelId).toBe('t1');
  });
});
