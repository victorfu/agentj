import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface CliConfig {
  apiBaseUrl: string;
  appBaseUrl: string;
  gatewayUrl: string;
  configFile: string;
}

export function resolveCliConfig(): CliConfig {
  const appBaseUrl = process.env.AGENTJ_APP_BASE_URL ?? 'http://localhost:3000';
  const configFile = resolveConfigFilePath();
  return {
    apiBaseUrl: process.env.AGENTJ_API_BASE_URL ?? appBaseUrl,
    appBaseUrl,
    gatewayUrl: process.env.AGENTJ_GATEWAY_URL ?? 'ws://localhost:4000/agent/v1/connect',
    configFile
  };
}

function resolveConfigFilePath(): string {
  const explicitPath = process.env.AGENTJ_CONFIG_FILE;
  if (explicitPath) {
    return normalizeConfigPath(explicitPath);
  }

  return join(homedir(), '.agentj', 'config.yml');
}

function normalizeConfigPath(value: string): string {
  return isAbsolute(value) ? value : join(homedir(), value.replace(/^\//, ''));
}
