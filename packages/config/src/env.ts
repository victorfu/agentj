import { z } from 'zod';

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AGENTJ_TUNNEL_BASE_DOMAIN: z.string().min(1),
  AGENTJ_CONNECT_TOKEN_SECRET: z.string().min(16),
  AGENTJ_APP_BASE_URL: z.string().url()
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;

export function parseSharedEnv(raw: NodeJS.ProcessEnv): SharedEnv {
  return sharedEnvSchema.parse(raw);
}
