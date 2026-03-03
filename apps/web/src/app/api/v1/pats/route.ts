import { randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { generatePatToken, getPatPrefix, hashPatToken, patTokens } from '@agentj/contracts';

import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { ensureMvpUser } from '@/lib/mvp-user';

export const dynamic = 'force-dynamic';

const DEFAULT_PAT_SCOPES = ['tunnels:write', 'requests:read'];

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export async function GET() {
  const user = await ensureMvpUser();

  const tokens = await db
    .select({
      id: patTokens.id,
      prefix: patTokens.prefix,
      token: patTokens.tokenPlaintext,
      scopes: patTokens.scopes,
      createdAt: patTokens.createdAt,
      expiresAt: patTokens.expiresAt,
    })
    .from(patTokens)
    .where(
      and(
        eq(patTokens.userId, user.id),
        isNull(patTokens.revokedAt),
      ),
    );

  return jsonNoStore(
    tokens.map((t) => ({
      id: t.id,
      prefix: t.prefix,
      token: t.token,
      scopes: t.scopes,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt?.toISOString() ?? null,
    })),
  );
}

export async function POST() {
  const user = await ensureMvpUser();

  for (let i = 0; i < 5; i += 1) {
    const token = generatePatToken();
    const tokenHash = hashPatToken(token);

    try {
      const [created] = await db
        .insert(patTokens)
        .values({
          id: `pat_${randomUUID()}`,
          userId: user.id,
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
