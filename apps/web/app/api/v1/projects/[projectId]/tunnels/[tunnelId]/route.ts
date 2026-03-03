import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auditLogs, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/http';
import { hasProjectAccess } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(
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

  const deleted = await db
    .delete(tunnels)
    .where(and(eq(tunnels.projectId, projectId), eq(tunnels.id, tunnelId)))
    .returning({ id: tunnels.id });

  if (deleted.length === 0) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  await db.insert(auditLogs).values({
    id: `aud_${randomUUID()}`,
    userId: auth.userId,
    projectId,
    action: 'tunnel.delete',
    metadata: {
      tunnelId
    }
  });

  return new NextResponse(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store'
    }
  });
}
