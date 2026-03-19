import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { lineChannels, tunnels } from '@agentj/contracts';

import { requirePatAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { lineWebhookUrl } from '@/lib/line-api';
import { hasPatScope } from '@/lib/pat-scope';
import { findAccessibleTunnel } from '@/lib/tunnel-access';

export const dynamic = 'force-dynamic';

const createLineChannelSchema = z.object({
  name: z.string().min(1).max(120),
  tunnelId: z.string().min(1),
  lineChannelId: z.string().min(1),
  channelSecret: z.string().min(1),
  channelAccessToken: z.string().min(1),
  mode: z.enum(['relay', 'managed']).default('relay')
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

export async function GET(request: NextRequest) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }
  if (!hasPatScope(auth, 'line:manage')) {
    return jsonError('FORBIDDEN', 'Missing scope line:manage', 403);
  }

  const rows = await db.query.lineChannels.findMany({
    where: eq(lineChannels.workspaceId, auth.workspaceId),
    orderBy: (fields, { desc }) => [desc(fields.createdAt)]
  });

  const tunnelIds = rows.map((row) => row.tunnelId);
  const tunnelRows = tunnelIds.length
    ? await db
        .select({ id: tunnels.id, subdomain: tunnels.subdomain })
        .from(tunnels)
        .where(and(eq(tunnels.workspaceId, auth.workspaceId), inArray(tunnels.id, tunnelIds)))
    : [];

  const subdomainByTunnelId = new Map(tunnelRows.map((row) => [row.id, row.subdomain]));

  return jsonNoStore(rows.map((row) => serializeLineChannel(row, subdomainByTunnelId.get(row.tunnelId) ?? null)));
}

export async function POST(request: NextRequest) {
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

  const parsed = createLineChannelSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  const tunnel = await findAccessibleTunnel(auth.workspaceId, parsed.data.tunnelId);
  if (!tunnel) {
    return jsonError('NOT_FOUND', 'Tunnel not found', 404);
  }

  try {
    const [created] = await db
      .insert(lineChannels)
      .values({
        id: `lch_${randomUUID()}`,
        workspaceId: auth.workspaceId,
        tunnelId: tunnel.id,
        name: parsed.data.name,
        lineChannelId: parsed.data.lineChannelId,
        channelSecret: parsed.data.channelSecret,
        channelAccessToken: parsed.data.channelAccessToken,
        webhookPath: '/line/webhook',
        mode: parsed.data.mode,
        webhookActive: false,
        createdBy: auth.userId,
        updatedAt: new Date()
      })
      .returning();

    if (!created) {
      return jsonError('INTERNAL_ERROR', 'Failed to create LINE channel', 500);
    }

    return jsonNoStore(serializeLineChannel(created, tunnel.subdomain), 201);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      return jsonError('CONFLICT', 'Tunnel is already bound to a LINE channel', 409);
    }

    console.error('create line channel failed', error);
    return jsonError('INTERNAL_ERROR', 'Failed to create LINE channel', 500);
  }
}
