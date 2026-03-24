import { randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { generatePatToken, getPatPrefix, hashPatToken, patTokens } from '@agentj/contracts';

import { requireSessionAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db-errors';

export const dynamic = 'force-dynamic';

const DEFAULT_PAT_SCOPES = ['tunnels:write', 'requests:read', 'line:manage', 'line:messages'];

export async function GET(request: NextRequest) {
  const auth = await requireSessionAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Not logged in', 401);
  }

  const tokens = await db
    .select({
      id: patTokens.id,
      userId: patTokens.userId,
      prefix: patTokens.prefix,
      token: patTokens.tokenPlaintext,
      scopes: patTokens.scopes,
      createdAt: patTokens.createdAt,
      expiresAt: patTokens.expiresAt,
    })
    .from(patTokens)
    .where(
      and(
        eq(patTokens.userId, auth.userId),
        eq(patTokens.workspaceId, auth.workspaceId),
        isNull(patTokens.revokedAt),
      ),
    );

  return jsonNoStore(
    tokens.map((t) => ({
        id: t.id,
        userId: t.userId,
        prefix: t.prefix,
        token: t.token,
        scopes: t.scopes,
        createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt?.toISOString() ?? null,
    })),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Not logged in', 401);
  }

  for (let i = 0; i < 5; i += 1) {
    const token = generatePatToken();
    const tokenHash = hashPatToken(token);

    try {
      const [created] = await db
        .insert(patTokens)
        .values({
          id: `pat_${randomUUID()}`,
          userId: auth.userId,
          workspaceId: auth.workspaceId,
          createdByUserId: auth.userId,
          prefix: getPatPrefix(token),
          tokenPlaintext: token,
          tokenHash,
          scopes: DEFAULT_PAT_SCOPES,
        })
        .returning({ id: patTokens.id, createdAt: patTokens.createdAt });

      if (!created) {
        return jsonError('INTERNAL_ERROR', 'Failed to create PAT', 500);
      }

      return jsonNoStore(
        {
          token,
          id: created.id,
          createdAt: created.createdAt.toISOString(),
        },
        201,
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }

      console.error('failed to create PAT', error);
      return jsonError('INTERNAL_ERROR', 'Failed to create PAT', 500);
    }
  }

  return jsonError('CONFLICT', 'Unable to allocate unique PAT', 409);
}
