import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { workspaces } from '@agentj/contracts';

import { requireSessionAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireSessionAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Not logged in', 401);
  }

  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, auth.workspaceId) });
  if (!workspace) {
    return jsonError('FORBIDDEN', 'Workspace not found', 403);
  }

  return jsonNoStore({
    user: {
      id: auth.userId,
      email: auth.email,
      name: auth.name
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      role: auth.role
    }
  });
}
