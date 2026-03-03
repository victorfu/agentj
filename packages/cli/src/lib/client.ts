import { AgentjApiClient } from '@agentj/sdk';

import { resolveCliConfig } from './config.js';
import { loadToken } from './token-store.js';

export async function loadApiClient(): Promise<AgentjApiClient> {
  const config = resolveCliConfig();
  const token = await loadToken(config.tokenStorageFile);
  return new AgentjApiClient({
    baseUrl: config.apiBaseUrl,
    token: token ?? undefined
  });
}
