import { describe, expect, it } from 'vitest';

import { parseGatewayMessage } from './messages.js';

describe('gateway messages', () => {
  it('parses a valid message payload', () => {
    const message = parseGatewayMessage(
      JSON.stringify({
        type: 'agent_response_start',
        streamId: 'str_1',
        statusCode: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    expect(message.type).toBe('agent_response_start');
  });

  it('throws for invalid payload shape', () => {
    expect(() =>
      parseGatewayMessage(
        JSON.stringify({
          type: 'agent_response_start',
          streamId: 'str_1'
        })
      )
    ).toThrow();
  });
});
