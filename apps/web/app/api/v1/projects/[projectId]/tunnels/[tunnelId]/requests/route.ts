import { and, desc, eq, lt } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { ingressRequests, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { hasProjectAccess } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export async function GET(
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

  const cursor = request.nextUrl.searchParams.get('cursor');
  let cursorDate: Date | null = null;
  if (cursor !== null) {
    const cursorMs = Number(cursor);
    if (!Number.isFinite(cursorMs)) {
      return jsonError('VALIDATION_ERROR', 'Invalid cursor', 400);
    }

    cursorDate = new Date(cursorMs);
    if (Number.isNaN(cursorDate.getTime())) {
      return jsonError('VALIDATION_ERROR', 'Invalid cursor', 400);
    }
  }

  const conditions = [eq(ingressRequests.tunnelId, tunnel.id)];
  if (cursorDate) {
    conditions.push(lt(ingressRequests.startedAt, cursorDate));
  }

  const rows = await db
    .select()
    .from(ingressRequests)
    .where(and(...conditions))
    .orderBy(desc(ingressRequests.startedAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const nextCursor = hasMore
    ? items[items.length - 1]?.startedAt.getTime().toString() ?? null
    : null;

  return jsonNoStore({
    items: items.map((row) => ({
      id: row.id,
      tunnelId: row.tunnelId,
      streamId: row.streamId,
      method: row.method,
      host: row.host,
      path: row.path,
      query: row.query,
      statusCode: row.statusCode,
      latencyMs: row.latencyMs,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      requestTruncated: row.requestTruncated,
      responseTruncated: row.responseTruncated
    })),
    nextCursor
  });
}
