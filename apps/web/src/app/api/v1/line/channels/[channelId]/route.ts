import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { lineChannels, tunnels } from '@agentj/contracts';

import { requirePatAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { lineWebhookUrl } from '@/lib/line-api';
import { hasPatScope } from '@/lib/pat-scope';

export const dynamic = 'force-dynamic';

const updateLineChannelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  channelSecret: z.string().min(1).optional(),
  channelAccessToken: z.string().min(1).optional(),
  mode: z.enum(['relay', 'managed']).optional()
});

function serializeLineChannel(
  row: typeof lineChannels.$inferSelect,
  tunnelSubdomain: string | null
) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    tunnelId: row.tunnelId,
    name: row.name,
    lineChannelId: row.lineChannelId,
    mode: row.mode,
    webhookPath: row.webhookPath,
    webhookActive: row.webhookActive,
    webhookUrl: tunnelSubdomain ? lineWebhookUrl(tunnelSubdomain) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function getChannel(authWorkspaceId: string, channelId: string) {
  const channel = await db.query.lineChannels.findFirst({
    where: and(eq(lineChannels.id, channelId), eq(lineChannels.workspaceId, authWorkspaceId))
  });
  if (!channel) {
    return null;
  }

  const tunnel = await db.query.tunnels.findFirst({
    where: and(eq(tunnels.id, channel.tunnelId), eq(tunnels.workspaceId, authWorkspaceId))
  });

  if (!tunnel) {
    return null;
  }

  return { channel, tunnel };
}

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
  const result = await getChannel(auth.workspaceId, channelId);
  if (!result) {
    return jsonError('NOT_FOUND', 'LINE channel not found', 404);
  }

  return jsonNoStore(serializeLineChannel(result.channel, result.tunnel.subdomain));
}

export async function PATCH(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = updateLineChannelSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  const { channelId } = await context.params;
  const found = await getChannel(auth.workspaceId, channelId);
  if (!found) {
    return jsonError('NOT_FOUND', 'LINE channel not found', 404);
  }

  const [updated] = await db
    .update(lineChannels)
    .set({
      name: parsed.data.name ?? found.channel.name,
      channelSecret: parsed.data.channelSecret ?? found.channel.channelSecret,
      channelAccessToken: parsed.data.channelAccessToken ?? found.channel.channelAccessToken,
      mode: parsed.data.mode ?? found.channel.mode,
      updatedAt: new Date()
    })
    .where(eq(lineChannels.id, found.channel.id))
    .returning();

  if (!updated) {
    return jsonError('INTERNAL_ERROR', 'Failed to update LINE channel', 500);
  }

  return jsonNoStore(serializeLineChannel(updated, found.tunnel.subdomain));
}
