import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { sessions } from '@agentj/contracts';

import { SESSION_COOKIE_NAME, hashSessionToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonNoStore } from '@/lib/http';
import { buildExpiredSessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashSessionToken(token);
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.sessionTokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  const response = jsonNoStore({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', buildExpiredSessionCookieOptions());
  return response;
}
