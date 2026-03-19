import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { patTokens } from '@agentj/contracts';

import { requireSessionAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ patId: string }> },
) {
  const auth = await requireSessionAuth(_request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Not logged in', 401);
  }

  const { patId } = await context.params;

  const [updated] = await db
    .update(patTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(patTokens.id, patId),
        eq(patTokens.userId, auth.userId),
        eq(patTokens.workspaceId, auth.workspaceId),
        isNull(patTokens.revokedAt),
      ),
    )
    .returning({ id: patTokens.id });

  if (!updated) {
    return jsonError('NOT_FOUND', 'PAT not found or already revoked', 404);
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}
