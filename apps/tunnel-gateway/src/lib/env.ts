import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

export const gatewayEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AGENTJ_TUNNEL_BASE_DOMAIN: z.string().min(1),
  AGENTJ_CONNECT_TOKEN_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  AGENTJ_REQUEST_BODY_LIMIT_BYTES: z.coerce.number().default(262144),
  AGENTJ_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AGENTJ_AGENT_HELLO_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  AGENTJ_AGENT_PING_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  AGENTJ_AGENT_MAX_MISSED_PONGS: z.coerce.number().int().nonnegative().default(2),
  AGENTJ_WS_SEND_HIGH_WATERMARK_BYTES: z.coerce.number().int().positive().default(1048576),
  AGENTJ_MAX_ACTIVE_STREAMS_PER_TUNNEL: z.coerce.number().int().positive().default(128),
  AGENTJ_MAX_ACTIVE_STREAMS_GLOBAL: z.coerce.number().int().positive().default(4096),
  AGENTJ_AGENT_RECONNECT_GRACE_MS: z.coerce.number().int().positive().default(5000)
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvFile = resolve(__dirname, '../../../../.env');
const requiredGatewayKeys = ['DATABASE_URL', 'AGENTJ_TUNNEL_BASE_DOMAIN', 'AGENTJ_CONNECT_TOKEN_SECRET'] as const;

function maybeLoadRootEnv(raw: NodeJS.ProcessEnv): void {
  if (raw !== process.env) {
    return;
  }

  if (requiredGatewayKeys.every((key) => Boolean(process.env[key]))) {
    return;
  }

  const loadEnvFile = (
    process as NodeJS.Process & {
      loadEnvFile?: (path?: string) => void;
    }
  ).loadEnvFile;

  if (!loadEnvFile) {
    return;
  }

  try {
    loadEnvFile(rootEnvFile);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

export function loadGatewayEnv(raw: NodeJS.ProcessEnv): GatewayEnv {
  maybeLoadRootEnv(raw);
  return gatewayEnvSchema.parse(raw);
}
