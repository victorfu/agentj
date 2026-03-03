import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { auditLogs, tunnels } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';
import { hasProjectAccess } from '@/lib/permissions';

const createTunnelSchema = z.object({
  targetHost: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535)
});

export const dynamic = 'force-dynamic';

function randomSubdomain(): string {
  return Math.random().toString(36).slice(2, 10);
}

function tunnelPublicUrl(subdomain: string): string {
  return `https://${subdomain}.${getWebEnv().AGENTJ_TUNNEL_BASE_DOMAIN}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { projectId } = await context.params;
  const ok = await hasProjectAccess(auth.userId, projectId);
  if (!ok) {
    return jsonError('FORBIDDEN', 'No access to project', 403);
  }

  const rows = await db
    .select()
    .from(tunnels)
    .where(eq(tunnels.projectId, projectId))
    .orderBy(desc(tunnels.createdAt));

  return jsonNoStore(
    rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      subdomain: row.subdomain,
      publicUrl: tunnelPublicUrl(row.subdomain),
      status: row.status,
      targetHost: row.targetHost,
      targetPort: row.targetPort,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }))
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const { projectId } = await context.params;
  const ok = await hasProjectAccess(auth.userId, projectId);
  if (!ok) {
    return jsonError('FORBIDDEN', 'No access to project', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = createTunnelSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  let createdTunnel = null;
  for (let i = 0; i < 5; i += 1) {
    const subdomain = randomSubdomain();

    try {
      const [created] = await db
        .insert(tunnels)
        .values({
          id: `tun_${randomUUID()}`,
          projectId,
          subdomain,
          status: 'offline',
          targetHost: parsed.data.targetHost,
          targetPort: parsed.data.targetPort,
          createdBy: auth.userId
        })
        .returning();
      createdTunnel = created;
      break;
    } catch {
      continue;
    }
  }

  if (!createdTunnel) {
    return jsonError('CONFLICT', 'Could not allocate subdomain', 409);
  }

  await db.insert(auditLogs).values({
    id: `aud_${randomUUID()}`,
    userId: auth.userId,
    projectId,
    action: 'tunnel.create',
    metadata: {
      tunnelId: createdTunnel.id,
      targetHost: createdTunnel.targetHost,
      targetPort: createdTunnel.targetPort
    }
  });

  return jsonNoStore(
    {
      id: createdTunnel.id,
      projectId: createdTunnel.projectId,
      subdomain: createdTunnel.subdomain,
      publicUrl: tunnelPublicUrl(createdTunnel.subdomain),
      status: createdTunnel.status,
      targetHost: createdTunnel.targetHost,
      targetPort: createdTunnel.targetPort,
      createdAt: createdTunnel.createdAt.toISOString(),
      updatedAt: createdTunnel.updatedAt.toISOString()
    },
    201
  );
}
