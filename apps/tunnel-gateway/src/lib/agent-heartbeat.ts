export interface AgentHeartbeatState {
  missedPongs: number;
  maxMissedPongs: number;
}

export function createAgentHeartbeatState(maxMissedPongs: number): AgentHeartbeatState {
  return {
    missedPongs: 0,
    maxMissedPongs
  };
}

export function markAgentPingAndShouldClose(state: AgentHeartbeatState): boolean {
  state.missedPongs += 1;
  return state.missedPongs > state.maxMissedPongs;
}

export function markAgentPong(state: AgentHeartbeatState): void {
  state.missedPongs = 0;
}
