import { type NextRequest } from 'next/server';

import { requirePatAuth } from '@/lib/auth';
import { jsonError, jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePatAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  return jsonNoStore({
    user: {
      id: auth.userId,
      email: auth.email,
      name: auth.name
    }
  });
}
