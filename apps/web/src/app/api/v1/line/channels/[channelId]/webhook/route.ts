import { type NextRequest } from 'next/server';

import { requirePatAuth } from '@/lib/auth';
import { findAccessibleLineChannelWithTunnel } from '@/lib/line-channel-access';
import { jsonError, jsonNoStore } from '@/lib/http';
import { callLineApi, lineWebhookUrl } from '@/lib/line-api';
import { hasPatScope } from '@/lib/pat-scope';

export const dynamic = 'force-dynamic';

export async function GET(
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

  const expectedWebhookUrl = lineWebhookUrl(found.tunnel.subdomain);
  const line = await callLineApi({
    lineChannelId: found.channel.id,
    channelAccessToken: found.channel.channelAccessToken,
    endpoint: '/v2/bot/channel/webhook/endpoint',
    method: 'GET'
  });
  const webhookActive = typeof line.data?.active === 'boolean' ? line.data.active : false;

  return jsonNoStore({
    channelId: found.channel.id,
    expectedWebhookUrl,
    webhookActive,
    lineStatus: line.status,
    lineResult: line.data,
    lineRequestId: line.lineRequestId
  });
}
