import { describe, expect, it } from 'vitest';

import { AgentjApiClient } from './index.js';

describe('sdk', () => {
  it('stores token', () => {
    const client = new AgentjApiClient({
      baseUrl: 'http://localhost:3000',
      token: 't1',
      fetchImpl: async () => new Response('{}')
    });

    client.setToken('t2');
    expect(client.token).toBe('t2');
  });
});
