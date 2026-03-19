import { type NextRequest } from 'next/server';

import { requirePatAuth } from '@/lib/auth';
import { findAccessibleLineChannelWithTunnel } from '@/lib/line-channel-access';
import { jsonError, jsonNoStore } from '@/lib/http';
import { callLineApi } from '@/lib/line-api';
import { hasPatScope } from '@/lib/pat-scope';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ channelId: string; userId: string }> }
) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }
  if (!hasPatScope(auth, 'line:messages')) {
    return jsonError('FORBIDDEN', 'Missing scope line:messages', 403);
  }

  const { channelId, userId } = await context.params;
  const found = await findAccessibleLineChannelWithTunnel(auth.workspaceId, channelId);
  if (!found) {
    return jsonError('NOT_FOUND', 'LINE channel not found', 404);
  }

  const result = await callLineApi({
    lineChannelId: found.channel.id,
    channelAccessToken: found.channel.channelAccessToken,
    endpoint: `/v2/bot/profile/${encodeURIComponent(userId)}`,
    method: 'GET'
  });

  if (!result.ok) {
    return jsonError('LINE_API_ERROR', result.rawText || 'Profile lookup failed', result.status);
  }

  return jsonNoStore({
    ok: true,
    lineRequestId: result.lineRequestId,
    result: result.data
  });
}
