import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { createConnectToken, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';
import { hasProjectAccess } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; tunnelId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { projectId, tunnelId } = await context.params;
  const ok = await hasProjectAccess(auth.userId, projectId);
  if (!ok) {
    return jsonError('FORBIDDEN', 'No access to project', 403);
  }

  const tunnel = await db.query.tunnels.findFirst({
    where: and(eq(tunnels.projectId, projectId), eq(tunnels.id, tunnelId))
  });

  if (!tunnel) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  const exp = Math.floor(Date.now() / 1000) + 60;

  const token = createConnectToken(
    {
      userId: auth.userId,
      projectId,
      tunnelId,
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
