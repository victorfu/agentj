import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { patTokens } from '@agentj/contracts';

import { requireSessionAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';
import { listAccessibleTunnels } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

function tunnelPublicUrl(subdomain: string): string {
  const env = getWebEnv();
  const defaultPort = env.AGENTJ_TUNNEL_PUBLIC_SCHEME === 'https' ? 443 : 80;
  const portSuffix =
    env.AGENTJ_TUNNEL_PUBLIC_PORT === defaultPort ? '' : `:${env.AGENTJ_TUNNEL_PUBLIC_PORT}`;
  return `${env.AGENTJ_TUNNEL_PUBLIC_SCHEME}://${subdomain}.${env.AGENTJ_TUNNEL_BASE_DOMAIN}${portSuffix}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ patId: string }> }
) {
  const auth = await requireSessionAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Not logged in', 401);
  }

  const { patId } = await context.params;

  // Verify the target PAT belongs to the current user in the same workspace.
  const targetPat = await db.query.patTokens.findFirst({
    where: and(
      eq(patTokens.id, patId),
      eq(patTokens.userId, auth.userId),
      eq(patTokens.workspaceId, auth.workspaceId)
    )
  });

  if (!targetPat) {
    return jsonError('NOT_FOUND', 'PAT not found', 404);
  }

  const rows = await listAccessibleTunnels(auth.workspaceId, patId);

  return jsonNoStore(
    rows.map((row) => ({
      id: row.id,
      subdomain: row.subdomain,
      publicUrl: tunnelPublicUrl(row.subdomain),
      status: row.status,
      targetHost: row.targetHost,
      targetPort: row.targetPort,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }))
  );
}
