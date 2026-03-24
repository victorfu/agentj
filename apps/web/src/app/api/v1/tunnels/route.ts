import { randomUUID } from 'node:crypto';

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { and, eq, ne, sql } from 'drizzle-orm';

import { auditLogs, tunnels, users } from '@agentj/contracts';

import { requirePatAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';
import { listAccessibleTunnels } from '@/lib/tunnel-access';

const createTunnelSchema = z.object({
  targetHost: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535)
});

export const dynamic = 'force-dynamic';

function randomSubdomain(): string {
  return Math.random().toString(36).slice(2, 10);
}

function tunnelPublicUrl(subdomain: string): string {
  const env = getWebEnv();
  const defaultPort = env.AGENTJ_TUNNEL_PUBLIC_SCHEME === 'https' ? 443 : 80;
  const portSuffix =
    env.AGENTJ_TUNNEL_PUBLIC_PORT === defaultPort ? '' : `:${env.AGENTJ_TUNNEL_PUBLIC_PORT}`;
  return `${env.AGENTJ_TUNNEL_PUBLIC_SCHEME}://${subdomain}.${env.AGENTJ_TUNNEL_BASE_DOMAIN}${portSuffix}`;
}

function serializeTunnel(row: typeof tunnels.$inferSelect) {
  return {
    id: row.id,
    subdomain: row.subdomain,
    publicUrl: tunnelPublicUrl(row.subdomain),
    status: row.status,
    targetHost: row.targetHost,
    targetPort: row.targetPort,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function GET(request: NextRequest) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const rows = await listAccessibleTunnels(auth.workspaceId, auth.patTokenId);
  return jsonNoStore(rows.map(serializeTunnel));
}

export async function POST(request: NextRequest) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { isAnonymous: true }
  });

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

  let createdTunnel: typeof tunnels.$inferSelect | null = null;
  for (let i = 0; i < 5; i += 1) {
    const subdomain = randomSubdomain();
    try {
      if (user?.isAnonymous) {
        // Use advisory lock to prevent TOCTOU race on anonymous tunnel limit
        const row = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${auth.workspaceId}))`);

          const activeTunnels = await tx
            .select({ id: tunnels.id })
            .from(tunnels)
            .where(
              and(
                eq(tunnels.workspaceId, auth.workspaceId),
                ne(tunnels.status, 'stopped')
              )
            );

          if (activeTunnels.length >= 1) {
            return null;
          }

          const [created] = await tx
            .insert(tunnels)
            .values({
              id: `tun_${randomUUID()}`,
              patTokenId: auth.patTokenId,
              workspaceId: auth.workspaceId,
              subdomain,
              status: 'offline',
              targetHost: parsed.data.targetHost,
              targetPort: parsed.data.targetPort,
              createdBy: auth.userId
            })
            .returning();

          return created ?? null;
        });

        if (row === null) {
          return jsonError(
            'ANONYMOUS_TUNNEL_LIMIT',
            'Anonymous users are limited to 1 concurrent tunnel. Register for unlimited tunnels.',
            429
          );
        }

        createdTunnel = row;
      } else {
        const [created] = await db
          .insert(tunnels)
          .values({
            id: `tun_${randomUUID()}`,
            patTokenId: auth.patTokenId,
            workspaceId: auth.workspaceId,
            subdomain,
            status: 'offline',
            targetHost: parsed.data.targetHost,
            targetPort: parsed.data.targetPort,
            createdBy: auth.userId
          })
          .returning();

        createdTunnel = created ?? null;
      }

      break;
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }
      console.error('create tunnel failed', error);
      return jsonError('INTERNAL_ERROR', 'Failed to create tunnel', 500);
    }
  }

  if (!createdTunnel) {
    return jsonError('CONFLICT', 'Could not allocate subdomain', 409);
  }

  await db.insert(auditLogs).values({
    id: `aud_${randomUUID()}`,
    userId: auth.userId,
    action: 'tunnel.create',
    metadata: {
      tunnelId: createdTunnel.id,
      targetHost: createdTunnel.targetHost,
      targetPort: createdTunnel.targetPort
    }
  });

  return jsonNoStore(serializeTunnel(createdTunnel), 201);
}
