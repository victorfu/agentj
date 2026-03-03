import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfig {
  apiBaseUrl: string;
  appBaseUrl: string;
  gatewayUrl: string;
  tokenStorageFile: string;
}

export function resolveCliConfig(): CliConfig {
  const appBaseUrl = process.env.AGENTJ_APP_BASE_URL ?? 'http://localhost:3000';
  return {
    apiBaseUrl: process.env.AGENTJ_API_BASE_URL ?? appBaseUrl,
    appBaseUrl,
    gatewayUrl: process.env.AGENTJ_GATEWAY_URL ?? 'ws://localhost:4000/agent/v1/connect',
    tokenStorageFile: join(
      homedir(),
      process.env.AGENTJ_PAT_STORAGE_FILE?.replace(/^\//, '') ?? '.agentj/pat-token'
    )
  };
}
