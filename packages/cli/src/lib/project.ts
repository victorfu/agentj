import type { AgentjApiClient } from '@agentj/sdk';

const TOKEN_HINT = 'No token found. Run `aj login <PAT>` first.';

type AuthClient = Pick<AgentjApiClient, 'token'>;

export function ensureLoggedIn(client: AuthClient): void {
  if (!client.token) {
    throw new Error(TOKEN_HINT);
  }
}
