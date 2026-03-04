import { describe, expect, it } from 'vitest';

import {
  createAgentHeartbeatState,
  markAgentPingAndShouldClose,
  markAgentPong
} from './agent-heartbeat.js';

describe('agent heartbeat state', () => {
  it('closes only after missed pongs exceed limit', () => {
    const state = createAgentHeartbeatState(2);

    expect(markAgentPingAndShouldClose(state)).toBe(false);
    expect(markAgentPingAndShouldClose(state)).toBe(false);
    expect(markAgentPingAndShouldClose(state)).toBe(true);
  });

  it('resets missed pong counter when pong arrives', () => {
    const state = createAgentHeartbeatState(1);

    expect(markAgentPingAndShouldClose(state)).toBe(false);
    markAgentPong(state);
    expect(markAgentPingAndShouldClose(state)).toBe(false);
  });
});
