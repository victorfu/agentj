import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface CliConfig {
  apiBaseUrl: string;
  appBaseUrl: string;
  gatewayUrl: string;
  configFile: string;
}

export function resolveCliConfig(): CliConfig {
  // process.env.AGENTJ_BUILTIN_* are replaced at publish-build time by tsup define.
  // In dev (tsc build), they stay as runtime refs and resolve to undefined — env vars override.
  const appBaseUrl = process.env.AGENTJ_APP_BASE_URL ?? process.env.AGENTJ_BUILTIN_APP_URL ?? '';
  const configFile = resolveConfigFilePath();
  return {
    apiBaseUrl: process.env.AGENTJ_API_BASE_URL ?? appBaseUrl,
    appBaseUrl,
    gatewayUrl: process.env.AGENTJ_GATEWAY_URL ?? process.env.AGENTJ_BUILTIN_GATEWAY_URL ?? '',
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
