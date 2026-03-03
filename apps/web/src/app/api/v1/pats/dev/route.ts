import { randomBytes, randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { getPatPrefix, hashPatToken, patTokens, users } from '@agentj/contracts';

import { db } from '@/lib/db';
import { getWebEnv } from '@/lib/env';
import { jsonError, jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

const DEV_PAT_SCOPES = ['tunnels:write', 'requests:read'];

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function generateDevPat(): string {
  return `agentj_pat_dev_${randomBytes(18).toString('base64url')}`;
}

async function resolveDevUserId(): Promise<string | null> {
  const devUser = await db.query.users.findFirst({
    where: eq(users.email, 'dev@agentj.local')
  });
  return devUser?.id ?? null;
}

export async function GET() {
  if (!isDevelopmentMode()) {
    return jsonError('NOT_FOUND', 'Dev PAT endpoint is not available in production', 404);
  }

  return jsonNoStore({
    token: getWebEnv().AGENTJ_DEV_PAT_TOKEN
  });
}

export async function POST() {
  if (!isDevelopmentMode()) {
    return jsonError('NOT_FOUND', 'Dev PAT endpoint is not available in production', 404);
  }

  const userId = await resolveDevUserId();
  if (!userId) {
    return jsonError('PRECONDITION_FAILED', 'Dev user not found. Run `pnpm db:seed` first.', 412);
  }

  for (let i = 0; i < 5; i += 1) {
    const token = generateDevPat();
    const tokenHash = hashPatToken(token);

    try {
      const [created] = await db
        .insert(patTokens)
        .values({
          id: `pat_${randomUUID()}`,
          userId,
          prefix: getPatPrefix(token),
          tokenHash,
          scopes: DEV_PAT_SCOPES
        })
        .returning({ id: patTokens.id, createdAt: patTokens.createdAt });

      if (!created) {
        return jsonError('INTERNAL_ERROR', 'Failed to create PAT', 500);
      }

      return jsonNoStore(
        {
          token,
          id: created.id,
          createdAt: created.createdAt.toISOString()
        },
        201
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }

      console.error('failed to create dev PAT', error);
      return jsonError('INTERNAL_ERROR', 'Failed to create PAT', 500);
    }
  }

  return jsonError('CONFLICT', 'Unable to allocate unique PAT', 409);
}
