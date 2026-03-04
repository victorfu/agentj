import { z } from 'zod';

const webEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AGENTJ_TUNNEL_BASE_DOMAIN: z.string().min(1),
  AGENTJ_TUNNEL_PUBLIC_SCHEME: z.enum(['http', 'https']).default('http'),
  AGENTJ_TUNNEL_PUBLIC_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  AGENTJ_CONNECT_TOKEN_SECRET: z.string().min(16),
  AGENTJ_GATEWAY_WS_PUBLIC_URL: z.string().url().default('ws://localhost:4000/agent/v1/connect'),
  AGENTJ_AGENT_PING_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  AGENTJ_AGENT_MAX_MISSED_PONGS: z.coerce.number().int().nonnegative().default(2),
  AGENTJ_TUNNEL_ONLINE_GRACE_MS: z.coerce.number().int().positive().optional()
});

export type WebEnv = z.infer<typeof webEnvSchema>;

let cachedEnv: WebEnv | null = null;

export function getWebEnv(): WebEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = webEnvSchema.parse(process.env);
  return cachedEnv;
}
