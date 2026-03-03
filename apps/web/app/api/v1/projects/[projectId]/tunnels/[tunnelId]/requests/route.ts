import { and, desc, eq, lt, or } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { ingressRequests, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { hasProjectAccess } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface RequestLogCursor {
  startedAt: Date;
  requestId: string | null;
}

function parseCursor(raw: string): RequestLogCursor | null {
  const [timestampPart, requestIdPart] = raw.split(':');
  if (!timestampPart) {
    return null;
  }

  const cursorMs = Number(timestampPart);
  if (!Number.isFinite(cursorMs)) {
    return null;
  }

  const startedAt = new Date(cursorMs);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return {
    startedAt,
    requestId: requestIdPart && requestIdPart.length > 0 ? requestIdPart : null
  };
}

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
  let parsedCursor: RequestLogCursor | null = null;
  if (cursor !== null) {
    parsedCursor = parseCursor(cursor);
    if (!parsedCursor) {
      return jsonError('VALIDATION_ERROR', 'Invalid cursor', 400);
    }
  }

  let whereClause = eq(ingressRequests.tunnelId, tunnel.id);
  if (parsedCursor) {
    const cursorClause = parsedCursor.requestId
      ? or(
          lt(ingressRequests.startedAt, parsedCursor.startedAt),
          and(
            eq(ingressRequests.startedAt, parsedCursor.startedAt),
            lt(ingressRequests.id, parsedCursor.requestId)
          )
        )
      : lt(ingressRequests.startedAt, parsedCursor.startedAt);

    if (cursorClause) {
      const combined = and(whereClause, cursorClause);
      if (combined) {
        whereClause = combined;
      }
    }
  }

  const rows = await db
    .select()
    .from(ingressRequests)
    .where(whereClause)
    .orderBy(desc(ingressRequests.startedAt), desc(ingressRequests.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const tail = items[items.length - 1];
  const nextCursor = hasMore && tail ? `${tail.startedAt.getTime()}:${tail.id}` : null;

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
