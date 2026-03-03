import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auditLogs, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/http';
import { findAccessibleTunnel } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

export async function DELETE(
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

  const deleted = await db
    .delete(tunnels)
    .where(eq(tunnels.id, tunnel.id))
    .returning({ id: tunnels.id });

  if (deleted.length === 0) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  await db.insert(auditLogs).values({
    id: `aud_${randomUUID()}`,
    userId: auth.userId,
    action: 'tunnel.delete',
    metadata: {
      tunnelId: tunnel.id
    }
  });

  return new NextResponse(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store'
    }
  });
}
