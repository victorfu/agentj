import { type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, revokeSessionByToken } from '@/lib/auth';
import { jsonNoStore } from '@/lib/http';
import { buildExpiredSessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSessionByToken(token);
  }

  const response = jsonNoStore({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', buildExpiredSessionCookieOptions());
  return response;
}
