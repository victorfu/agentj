import { z } from 'zod';

export const gatewayEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AGENTJ_TUNNEL_BASE_DOMAIN: z.string().min(1),
  AGENTJ_CONNECT_TOKEN_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  AGENTJ_REQUEST_BODY_LIMIT_BYTES: z.coerce.number().default(262144)
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadGatewayEnv(raw: NodeJS.ProcessEnv): GatewayEnv {
  return gatewayEnvSchema.parse(raw);
}
