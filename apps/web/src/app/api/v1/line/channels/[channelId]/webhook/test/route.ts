import { type NextRequest } from 'next/server';

import { requirePatAuth } from '@/lib/auth';
import { findAccessibleLineChannelWithTunnel } from '@/lib/line-channel-access';
import { jsonError, jsonNoStore } from '@/lib/http';
import { callLineApi, lineWebhookUrl } from '@/lib/line-api';
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
  if (!hasPatScope(auth, 'line:manage')) {
    return jsonError('FORBIDDEN', 'Missing scope line:manage', 403);
  }

  const { channelId } = await context.params;
  const found = await findAccessibleLineChannelWithTunnel(auth.workspaceId, channelId);
  if (!found) {
    return jsonError('NOT_FOUND', 'LINE channel not found', 404);
  }

  const endpoint = lineWebhookUrl(found.tunnel.subdomain);
  const result = await callLineApi({
    lineChannelId: found.channel.id,
    channelAccessToken: found.channel.channelAccessToken,
    endpoint: '/v2/bot/channel/webhook/test',
    method: 'POST',
    body: { endpoint }
  });

  if (!result.ok) {
    return jsonError('LINE_API_ERROR', result.rawText || 'Webhook test failed', result.status);
  }

  return jsonNoStore({
    ok: true,
    channelId: found.channel.id,
    endpoint,
    lineRequestId: result.lineRequestId,
    result: result.data
  });
}
