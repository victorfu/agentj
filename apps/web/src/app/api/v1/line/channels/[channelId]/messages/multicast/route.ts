import { randomUUID } from 'node:crypto';

import { type NextRequest } from 'next/server';

import { requirePatAuth } from '@/lib/auth';
import { findAccessibleLineChannelWithTunnel } from '@/lib/line-channel-access';
import { jsonError, jsonNoStore } from '@/lib/http';
import { callLineApi } from '@/lib/line-api';
import { hasPatScope } from '@/lib/pat-scope';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ channelId: string }> }
) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }
  if (!hasPatScope(auth, 'line:messages')) {
    return jsonError('FORBIDDEN', 'Missing scope line:messages', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const { channelId } = await context.params;
  const found = await findAccessibleLineChannelWithTunnel(auth.workspaceId, channelId);
  if (!found) {
    return jsonError('NOT_FOUND', 'LINE channel not found', 404);
  }

  const result = await callLineApi({
    lineChannelId: found.channel.id,
    channelAccessToken: found.channel.channelAccessToken,
    endpoint: '/v2/bot/message/multicast',
    method: 'POST',
    body,
    retryKey: randomUUID()
  });

  if (!result.ok) {
    return jsonError('LINE_API_ERROR', result.rawText || 'Multicast failed', result.status);
  }

  return jsonNoStore({
    ok: true,
    lineRequestId: result.lineRequestId,
    lineAcceptedRequestId: result.lineAcceptedRequestId,
    result: result.data
  });
}
