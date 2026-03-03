import { z } from 'zod';

const webEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AGENTJ_TUNNEL_BASE_DOMAIN: z.string().min(1),
  AGENTJ_CONNECT_TOKEN_SECRET: z.string().min(16),
  AGENTJ_GATEWAY_WS_PUBLIC_URL: z.string().url().default('ws://localhost:4000/agent/v1/connect')
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
