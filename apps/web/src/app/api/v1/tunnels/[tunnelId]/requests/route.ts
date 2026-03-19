import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { ingressRequests } from '@agentj/contracts';

import { requirePatAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import {
  formatRequestLogCursor,
  parseRequestLogCursor,
  type RequestLogCursor
} from '@/lib/request-log-cursor';
import { findAccessibleTunnel } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tunnelId: string }> }
) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { tunnelId } = await context.params;
  const tunnel = await findAccessibleTunnel(auth.workspaceId, tunnelId, auth.patTokenId);
  if (!tunnel) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  const cursor = request.nextUrl.searchParams.get('cursor');
  const after = request.nextUrl.searchParams.get('after');
  if (cursor !== null && after !== null) {
    return jsonError('VALIDATION_ERROR', 'cursor and after cannot be used together', 400);
  }

  let parsedCursor: RequestLogCursor | null = null;
  if (cursor !== null) {
    parsedCursor = parseRequestLogCursor(cursor);
    if (!parsedCursor) {
      return jsonError('VALIDATION_ERROR', 'Invalid cursor', 400);
    }
  }

  let parsedAfter: RequestLogCursor | null = null;
  if (after !== null) {
    parsedAfter = parseRequestLogCursor(after);
    if (!parsedAfter) {
      return jsonError('VALIDATION_ERROR', 'Invalid after cursor', 400);
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

  if (parsedAfter) {
    const afterClause = parsedAfter.requestId
      ? or(
          gt(ingressRequests.startedAt, parsedAfter.startedAt),
          and(
            eq(ingressRequests.startedAt, parsedAfter.startedAt),
            gt(ingressRequests.id, parsedAfter.requestId)
          )
        )
      : gt(ingressRequests.startedAt, parsedAfter.startedAt);

    if (afterClause) {
      const combined = and(whereClause, afterClause);
      if (combined) {
        whereClause = combined;
      }
    }
  }

  const orderBy = parsedAfter
    ? [asc(ingressRequests.startedAt), asc(ingressRequests.id)]
    : [desc(ingressRequests.startedAt), desc(ingressRequests.id)];

  const rows = await db
    .select()
    .from(ingressRequests)
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const tail = items[items.length - 1];
  const nextCursor =
    hasMore && tail
      ? formatRequestLogCursor({
          startedAt: tail.startedAt,
          requestId: tail.id
        })
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
