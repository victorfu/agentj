import { type NextRequest } from 'next/server';

import { createConnectToken } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';
import { findAccessibleTunnel } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tunnelId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { tunnelId } = await context.params;
  const tunnel = await findAccessibleTunnel(auth.userId, tunnelId, auth.patTokenId);
  if (!tunnel) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = createConnectToken(
    {
      userId: auth.userId,
      tunnelId: tunnel.id,
      exp
    },
    getWebEnv().AGENTJ_CONNECT_TOKEN_SECRET
  );

  return jsonNoStore({
    connectToken: token,
    expiresInSeconds: 60,
    gatewayWebsocketUrl: getWebEnv().AGENTJ_GATEWAY_WS_PUBLIC_URL
  });
}
