import { and, asc, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { ingressPayloadChunks, ingressRequests } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { findAccessibleTunnel } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tunnelId: string; requestId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { tunnelId, requestId } = await context.params;
  const tunnel = await findAccessibleTunnel(auth.userId, tunnelId, auth.patTokenId);
  if (!tunnel) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  const reqLog = await db.query.ingressRequests.findFirst({
    where: and(eq(ingressRequests.id, requestId), eq(ingressRequests.tunnelId, tunnel.id))
  });

  if (!reqLog) {
    return jsonError('NOT_FOUND', 'Request log not found', 404);
  }

  const chunks = await db
    .select()
    .from(ingressPayloadChunks)
    .where(eq(ingressPayloadChunks.requestId, reqLog.id))
    .orderBy(asc(ingressPayloadChunks.createdAt), asc(ingressPayloadChunks.chunkIndex));

  return jsonNoStore({
    id: reqLog.id,
    tunnelId: reqLog.tunnelId,
    streamId: reqLog.streamId,
    method: reqLog.method,
    host: reqLog.host,
    path: reqLog.path,
    query: reqLog.query,
    statusCode: reqLog.statusCode,
    latencyMs: reqLog.latencyMs,
    startedAt: reqLog.startedAt.toISOString(),
    endedAt: reqLog.endedAt?.toISOString() ?? null,
    requestTruncated: reqLog.requestTruncated,
    responseTruncated: reqLog.responseTruncated,
    requestHeaders: reqLog.requestHeaders,
    responseHeaders: reqLog.responseHeaders,
    chunks: chunks.map((chunk) => ({
      direction: chunk.direction,
      index: chunk.chunkIndex,
      isBinary: chunk.isBinary,
      contentType: chunk.contentType,
      dataText: chunk.dataText,
      dataBase64: chunk.dataBase64,
      truncated: chunk.truncated,
      createdAt: chunk.createdAt.toISOString()
    }))
  });
}
